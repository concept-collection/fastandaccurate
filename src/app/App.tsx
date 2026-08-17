import { useEffect, useState } from "react";
import { HomePage } from "./pages/HomePage";
import { AboutPage } from "./pages/AboutPage";
import { ProblemPage } from "./pages/ProblemPage";

const REPO_URL = "https://github.com/concept-collection/fastandaccurate";

type Route =
  | { page: "home" }
  | { page: "about" }
  | { page: "problem"; problemId: string };

function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, "");
  if (path === "/about") return { page: "about" };
  const m = path.match(/^\/problem\/([a-z0-9-]+)$/);
  if (m) return { page: "problem", problemId: m[1] };
  return { page: "home" };
}

function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseRoute(location.hash));
  useEffect(() => {
    const onChange = () => {
      setRoute(parseRoute(location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

export function App() {
  const route = useRoute();

  useEffect(() => {
    document.title =
      route.page === "about"
        ? "About — fastandaccurate"
        : route.page === "problem"
          ? `${route.problemId} — fastandaccurate`
          : "fastandaccurate — PDE solver benchmarks";
  }, [route]);

  return (
    <main>
      {route.page !== "home" && (
        <nav className="topnav">
          <a href="#/">fastandaccurate</a>
        </nav>
      )}
      {route.page === "home" && <HomePage />}
      {route.page === "about" && <AboutPage />}
      {route.page === "problem" && <ProblemPage problemId={route.problemId} />}
      <footer>
        fastandaccurate · <a href="#/about">about</a> ·{" "}
        <a href={REPO_URL}>source</a> · Apache-2.0 · solvers run via{" "}
        <a href="https://numbl.org">numbl</a> {__NUMBL_VERSION__}
      </footer>
    </main>
  );
}
