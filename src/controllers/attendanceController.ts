import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiResponse } from "../utils/apiHandlerHelpers";
import { ApiError } from "../utils/apiHandlerHelpers";
import { Attendance } from "../models/attendanceModel";
import { Project } from "../models/projectModel";
import dayjs from "dayjs";
import { User } from "../models/userModel";

// Mark attendance (supports both project and normal types)
export const markAttendance = asyncHandler(
  async (req: Request, res: Response) => {
    const { projectId, userId } = req.params;
    console.log(userId);

    const { present, type = "project" } = req.body;
    const markedBy = req.user?.userId;

    // Get today's date at midnight (00:00:00)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Validate input
    if (typeof present !== "boolean") {
      throw new ApiError(400, "Present must be a boolean");
    }
    if (!["project", "normal"].includes(type)) {
      throw new ApiError(400, "Invalid attendance type");
    }

    let project;
    if (type === "project") {
      if (!projectId)
        throw new ApiError(
          400,
          "Project ID is required for project attendance"
        );

      project = await Project.findById(projectId);
      if (!project) throw new ApiError(404, "Project not found");

      // Check if user is assigned to project
      const isAssigned =
        project.assignedWorkers.some((w) => w.equals(userId)) ||
        project.assignedDriver.equals(userId);

      if (!isAssigned) {
        throw new ApiError(400, "User is not assigned to this project");
      }

      // Only assigned driver can mark attendance for project
      if (!project.assignedDriver.equals(markedBy)) {
        throw new ApiError(
          403,
          "Only assigned driver can mark project attendance"
        );
      }
    }

    // Find existing attendance record for today
    const nextDay = new Date(today);
    nextDay.setDate(today.getDate() + 1);

    const query: any = {
      user: userId,
      date: { $gte: today, $lt: nextDay },
      type,
    };

    if (type === "project") {
      query.project = projectId;
    }

    let attendance = await Attendance.findOne(query);

    if (attendance) {
      // Update existing record
      attendance.present = present;
      attendance.markedBy = markedBy;
      await attendance.save();
    } else {
      // Create new record
      attendance = await Attendance.create({
        project: type === "project" ? projectId : undefined,
        user: userId,
        present,
        markedBy,
        date: today,
        type,
      });
    }

    res
      .status(200)
      .json(new ApiResponse(200, attendance, "Attendance marked successfully"));
  }
);

// Get attendance records (supports both types)
export const getAttendance = asyncHandler(
  async (req: Request, res: Response) => {
    const { userId } = req.params;
    const { startDate, endDate, type = "project", projectId } = req.query;

    const filter: any = {
      user: userId,
      type,
    };

    // Add project filter if type is project
    if (type === "project" && projectId) {
      filter.project = projectId;
    }

    // Add date range if provided
    if (startDate && endDate) {
      filter.date = {
        $gte: new Date(startDate as string),
        $lte: new Date(endDate as string),
      };
    }

    const attendance = await Attendance.find(filter)
      .sort({ date: 1 })
      .populate("markedBy", "firstName lastName")
      .populate("project", "projectName");

    res
      .status(200)
      .json(new ApiResponse(200, attendance, "Attendance records retrieved"));
  }
);

// Get project attendance summary (only for project type)
export const getProjectAttendance = asyncHandler(
  async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const { date } = req.query;

    const filter: any = {
      project: projectId,
      type: "project",
    };
    if (date) filter.date = new Date(date as string);

    const attendance = await Attendance.find(filter)
      .populate("user", "firstName lastName")
      .populate("markedBy", "firstName lastName");

    res
      .status(200)
      .json(new ApiResponse(200, attendance, "Project attendance retrieved"));
  }
);

// Get today's project attendance (only for project type)
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
      type: "project",
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

// Get attendance summary (supports both types)
export const getAttendanceSummary = asyncHandler(
  async (req: Request, res: Response) => {
    const { type = "project" } = req.query;
    const { projectId } = req.params;
    const { startDate, endDate } = req.query;

    const dateFilter: any = { type };

    // For project type, require projectId
    if (type === "project") {
      if (!projectId) {
        throw new ApiError(
          400,
          "Project ID is required for project attendance summary"
        );
      }
      dateFilter.project = projectId;
    }

    // Date range handling
    if (startDate && endDate) {
      dateFilter.date = {
        $gte: new Date(startDate as string),
        $lte: new Date(endDate as string),
      };
    }

    // Get all attendance records
    const attendanceRecords = await Attendance.find(dateFilter)
      .populate("user", "firstName lastName profileImage")
      .populate("project", "projectName")
      .sort({ date: 1 });

    // Get unique dates
    const uniqueDates = [
      ...new Set(
        attendanceRecords.map((record) =>
          dayjs(record.date).format("YYYY-MM-DD")
        )
      ),
    ].sort();

    // Get all users who have attendance records
    const users = Array.from(
      new Set(attendanceRecords.map((record) => record.user))
    );

    // Create summary data structure
    const summary = uniqueDates.map((date) => {
      const dateObj: any = { date };

      users.forEach((user: any) => {
        const attendance = attendanceRecords.find(
          (record) =>
            dayjs(record.date).format("YYYY-MM-DD") === date &&
            record.user._id.toString() === user._id.toString()
        );

        dateObj[user._id.toString()] = attendance ? attendance.present : null;
      });

      return dateObj;
    });

    // Calculate totals
    const totals: any = { date: "Total" };
    users.forEach((user: any) => {
      totals[user._id.toString()] = attendanceRecords.filter(
        (record) =>
          record.user._id.toString() === user._id.toString() && record.present
      ).length;
    });

    res.status(200).json(
      new ApiResponse(
        200,
        {
          type,
          dates: uniqueDates,
          users: users.map((user: any) => ({
            _id: user._id,
            name: `${user.firstName} ${user.lastName}`,
            profileImage: user.profileImage,
          })),
          summary,
          totals,
          ...(type === "project" && { projectId }),
        },
        "Attendance summary retrieved successfully"
      )
    );
  }
);

export const dailyNormalAttendance = asyncHandler(
  async (req: Request, res: Response) => {
    const { date } = req.query;

    if (!date) {
      throw new ApiError(400, "Date is required");
    }

    const startDate = new Date(date as string);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 1);

    // Get all users except drivers and workers
    const users = await User.find({
      role: { $nin: ["driver", "worker"] },
    }).select("_id firstName lastName email profileImage role");

    // Get attendance records for the date
    const attendanceRecords = await Attendance.find({
      type: "normal",
      date: {
        $gte: startDate,
        $lt: endDate,
      },
    }).populate("markedBy", "firstName lastName");

    // Merge user data with attendance status
    const result = users.map((user) => {
      const attendance = attendanceRecords.find(
        (record) => record.user.toString() === user._id.toString()
      );

      return {
        user: {
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          profileImage: user.profileImage,
          role: user.role,
        },
        present: attendance?.present || false,
        markedBy: attendance?.markedBy || null,
        markedAt: attendance?.createdAt || null,
      };
    });
    // console.log("Daily Normal Attendance Result:", result);

    res.status(200).json(
      new ApiResponse(
        200,
        {
          date: startDate,
          users: result,
        },
        "Daily normal attendance retrieved successfully"
      )
    );
  }
);

export const getNormalMonthlyAttendance = asyncHandler(
  async (req: Request, res: Response) => {
    const { userId } = req.params;
    const { month, year } = req.query;

    if (!month || !year) {
      throw new ApiError(400, "Month and year are required");
    }

    const monthNum = parseInt(month as string);
    const yearNum = parseInt(year as string);

    if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      throw new ApiError(400, "Invalid month (must be 1-12)");
    }

    if (isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
      throw new ApiError(400, "Invalid year");
    }

    const startDate = new Date(yearNum, monthNum - 1, 1);
    const endDate = new Date(yearNum, monthNum, 0);
    endDate.setHours(23, 59, 59, 999);

    const attendance = await Attendance.find({
      user: userId,
      type: "normal",
      date: {
        $gte: startDate,
        $lte: endDate,
      },
    })
      .sort({ date: 1 })
      .populate("markedBy", "firstName lastName");

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          attendance,
          "Monthly normal attendance retrieved successfully"
        )
      );
  }
);
