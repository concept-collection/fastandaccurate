// The problem registry: what the home page lists. Each problem has its
// own page, spec document, instances, and solver interface; new problems
// add an entry here.

import { PROBLEM_ID, INSTANCES } from "./laplace2d/spec";
import { SOLVERS } from "../solvers";

export interface ProblemInfo {
  id: string;
  title: string;
  dimension: "2D" | "3D";
  /** One or two sentences for the problem list. */
  summary: string;
  instanceCount: number;
  solverCount: number;
  groundTruth: string;
}

export const PROBLEMS: ProblemInfo[] = [
  {
    id: PROBLEM_ID,
    title: "Interior Dirichlet Laplace problem",
    dimension: "2D",
    summary:
      "Laplace's equation on a star-shaped domain with Dirichlet data " +
      "manufactured from an exact harmonic function whose singularities " +
      "sit an adjustable distance outside the boundary.",
    instanceCount: INSTANCES.length,
    solverCount: SOLVERS.length,
    groundTruth: "exact",
  },
];
