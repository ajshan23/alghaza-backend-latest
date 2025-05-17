import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiResponse } from "../utils/apiHandlerHelpers";
import { ApiError } from "../utils/apiHandlerHelpers";
import { Attendance } from "../models/attendanceModel";
import { Project } from "../models/projectModel";
import dayjs from "dayjs";

// Mark attendance
export const markAttendance = asyncHandler(
  async (req: Request, res: Response) => {
    const { projectId, userId } = req.params;
    const { present } = req.body;
    const markedBy = req.user?.userId;

    // Get today's date at midnight (00:00:00)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Validate input
    if (typeof present !== "boolean") {
      throw new ApiError(400, "Present must be a boolean");
    }

    const project = await Project.findById(projectId);
    if (!project) throw new ApiError(404, "Project not found");

    // Check if user is assigned to project
    const isAssigned =
      project.assignedWorkers.some((w) => w.equals(userId)) ||
      project.assignedDriver.equals(userId);

    if (!isAssigned) {
      throw new ApiError(400, "User is not assigned to this project");
    }

    // Only assigned driver can mark attendance
    if (!project.assignedDriver.equals(markedBy)) {
      throw new ApiError(403, "Only assigned driver can mark attendance");
    }

    // Find existing attendance record for today
    const nextDay = new Date(today);
    nextDay.setDate(today.getDate() + 1);

    let attendance = await Attendance.findOne({
      project: projectId,
      user: userId,
      date: { $gte: today, $lt: nextDay },
    });

    if (attendance) {
      // Update existing record
      attendance.present = present;
      attendance.markedBy = markedBy;
      await attendance.save();
    } else {
      // Create new record
      attendance = await Attendance.create({
        project: projectId,
        user: userId,
        present,
        markedBy,
        date: today,
      });
    }

    res.status(200).json(
      new ApiResponse(200, attendance, "Attendance marked successfully")
    );
  }
);


// Get attendance records
export const getAttendance = asyncHandler(
  async (req: Request, res: Response) => {
    const { projectId, userId } = req.params;
    const { startDate, endDate } = req.query;

    const filter: any = {
      project: projectId,
      user: userId,
    };

    // Add date range if provided
    if (startDate && endDate) {
      filter.date = {
        $gte: new Date(startDate as string),
        $lte: new Date(endDate as string),
      };
    }

    const attendance = await Attendance.find(filter)
      .sort({ date: 1 })
      .populate("markedBy", "firstName lastName");

    res
      .status(200)
      .json(new ApiResponse(200, attendance, "Attendance records retrieved"));
  }
);

// Get project attendance summary
export const getProjectAttendance = asyncHandler(
  async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const { date } = req.query;

    const filter: any = { project: projectId };
    if (date) filter.date = new Date(date as string);

    const attendance = await Attendance.find(filter)
      .populate("user", "firstName lastName")
      .populate("markedBy", "firstName lastName");

    res
      .status(200)
      .json(new ApiResponse(200, attendance, "Project attendance retrieved"));
  }
);

// attendanceController.ts
export const getTodayProjectAttendance = asyncHandler(
  async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get project with assigned workers
    const project = await Project.findById(projectId)
      .populate(
        "assignedWorkers",
        "firstName lastName profileImage mobileNumber"
      )
      .populate("assignedDriver", "firstName lastName");

    if (!project) {
      throw new ApiError(404, "Project not found");
    }

    // Get today's attendance records
    const attendance = await Attendance.find({
      project: projectId,
      date: {
        $gte: today,
        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      },
    });

    // Merge worker data with attendance status
    const workersWithAttendance = project.assignedWorkers.map((worker) => {
      const attendanceRecord = attendance.find((record) =>
        record.user.equals(worker._id)
      );
      return {
        _id: worker._id,
        firstName: worker.firstName,
        lastName: worker.lastName,
        profileImage: worker.profileImage,
        mobileNumber: worker.mobileNumber,
        present: attendanceRecord?.present || false,
        markedBy: attendanceRecord?.markedBy || null,
        markedAt: attendanceRecord?.createdAt || null,
      };
    });

    res.status(200).json(
      new ApiResponse(
        200,
        {
          project: {
            _id: project._id,
            projectName: project.projectName,
            assignedDriver: project.assignedDriver,
          },
          workers: workersWithAttendance,
          date: today,
        },
        "Today's attendance retrieved successfully"
      )
    );
  }
);

// Add these new methods to your attendanceController.ts

export const getAttendanceSummary = asyncHandler(
  async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const { startDate, endDate } = req.query;

    // Validate project
    const project = await Project.findById(projectId).populate(
      "assignedWorkers",
      "firstName lastName profileImage"
    );

    if (!project) {
      throw new ApiError(404, "Project not found");
    }

    // Date range handling
    const dateFilter: any = { project: projectId };
    if (startDate && endDate) {
      dateFilter.date = {
        $gte: new Date(startDate as string),
        $lte: new Date(endDate as string),
      };
    }

    // Get all attendance records for this project
    const attendanceRecords = await Attendance.find(dateFilter)
      .populate("user", "firstName lastName profileImage")
      .sort({ date: 1 });

    // Get unique dates
    const uniqueDates = [
      ...new Set(
        attendanceRecords.map((record) =>
          dayjs(record.date).format("YYYY-MM-DD")
        )
      ),
    ].sort();

    // Get all assigned workers
    const workers = project.assignedWorkers || [];

    // Create summary data structure
    const summary = uniqueDates.map((date) => {
      const dateObj: any = { date };

      workers.forEach((worker) => {
        const attendance = attendanceRecords.find(
          (record) =>
            dayjs(record.date).format("YYYY-MM-DD") === date &&
            record.user._id.toString() === worker._id.toString()
        );

        dateObj[worker._id.toString()] = attendance ? attendance.present : null;
      });

      return dateObj;
    });

    // Calculate totals
    const totals: any = { date: "Total" };
    workers.forEach((worker) => {
      totals[worker._id.toString()] = attendanceRecords.filter(
        (record) =>
          record.user._id.toString() === worker._id.toString() && record.present
      ).length;
    });

    res.status(200).json(
      new ApiResponse(
        200,
        {
          dates: uniqueDates,
          workers: workers.map((worker) => ({
            _id: worker._id,
            name: `${worker.firstName} ${worker.lastName}`,
            profileImage: worker.profileImage,
          })),
          summary,
          totals,
        },
        "Attendance summary retrieved successfully"
      )
    );
  }
);
