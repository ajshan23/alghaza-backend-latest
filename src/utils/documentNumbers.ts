// utils/documentNumbers.ts
import { Project } from "../models/projectModel";
import { Types } from "mongoose";

export const generateProjectNumber = async (): Promise<string> => {
  const year = new Date().getFullYear().toString().slice(-2);
  const count = await Project.countDocuments();
  return `PRJ${year}${(count + 1).toString().padStart(4, "0")}`;
};

export const generateRelatedDocumentNumber = async (
  projectId: Types.ObjectId,
  prefix: string
): Promise<string> => {
  const project = await Project.findById(projectId);
  if (!project || !project.projectNumber) {
    throw new Error("Project not found or missing project number");
  }
  return project.projectNumber.replace("PRJ", prefix);
};
