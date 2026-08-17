#!/usr/bin/env node
/**
 * The published command's entry point, whose only job is to be parseable
 * by whatever node it lands on. main.js is a modern bundle: on an old node
 * its first `import {` is a syntax error pointing at a brace, before any
 * check inside it could run. This file is therefore deliberately ES5, and
 * the dynamic import is built at run time, which older node cannot parse
 * as written syntax either.
 */
"use strict";

var MIN_MAJOR = 20;
var have = process.versions.node;
var major = parseInt(have.split(".")[0], 10);

if (!(major >= MIN_MAJOR)) {
  process.stderr.write(
    "fastandaccurate: this is node " + have + ", and the harness needs node " +
      MIN_MAJOR + " or newer (WebCrypto as a global, among other things).\n" +
      "  nodejs.org has current builds; nvm, fnm and asdf install one per user\n" +
      "  without touching what the system depends on.\n"
  );
  process.exit(1);
}

var path = require("path");
var url = require("url");
var target = url.pathToFileURL(path.join(__dirname, "main.js")).href;

new Function("specifier", "return import(specifier);")(target).catch(function (e) {
  process.stderr.write(String((e && e.stack) || e) + "\n");
  process.exit(1);
});
