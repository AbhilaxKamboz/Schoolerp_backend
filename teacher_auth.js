const jwt = require("jsonwebtoken");
const { ClassSubject, Attendance, ClassStudent, Homework, Assignment, AssignmentSubmission, User,  Marks, StudentMarks, } = require("./models");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

// Existing functions (keep all your existing code here)
const getTeacherAssignments = async (req, res) => {
  try {
    const teacherId = req.user.id;

    const assignments = await ClassSubject.find({
      teacherId,
      isActive: true
    })
      .populate("classId", "className section")
      .populate("subjectId", "name code");

    res.json({
      total: assignments.length,
      assignments
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Mark attendance 
const markAttendance = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { classId, subjectId, date, records } = req.body;

    if (!classId || !subjectId || !date || !records?.length) {
      return res.status(400).json({ message: "Required data missing" });
    }

    const assignment = await ClassSubject.findOne({
      classId,
      subjectId,
      teacherId,
      isActive: true
    });

    if (!assignment) {
      return res.status(403).json({
        message: "You are not assigned to this class and subject"
      });
    }

    const bulkOps = records.map((r) => ({
      updateOne: {
        filter: {
          classId,
          subjectId,
          studentId: r.studentId,
          date
        },
        update: {
          classId,
          subjectId,
          teacherId,
          studentId: r.studentId,
          date,
          status: r.status,
          createdBy: teacherId
        },
        upsert: true
      }
    }));

    await Attendance.bulkWrite(bulkOps);
    res.json({ message: "Attendance marked successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// View attendance
const getAttendanceByClass = async (req, res) => {
  try {
    const { classId, subjectId, date } = req.query;

    const data = await Attendance.find({
      classId,
      subjectId,
      date
    }).populate("studentId", "name");

    res.json({ total: data.length, attendance: data });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Edit attendance
const editAttendance = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { attendanceId, status } = req.body;

    if (!attendanceId || !status) {
      return res.status(400).json({ message: "Required data missing" });
    }

    const attendance = await Attendance.findById(attendanceId);
    if (!attendance) {
      return res.status(404).json({ message: "Attendance record not found" });
    }

    if (attendance.teacherId.toString() !== teacherId) {
      return res.status(403).json({
        message: "You are not allowed to edit this attendance"
      });
    }

    attendance.status = status;
    await attendance.save();

    res.json({ message: "Attendance updated successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Create assignment
const createAssignment = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const {
      classId,
      subjectId,
      title,
      description,
      dueDate,
      totalMarks,
      type
    } = req.body;

    if (!classId || !subjectId || !title || !description || !dueDate) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    const assigned = await ClassSubject.findOne({
      classId: new mongoose.Types.ObjectId(classId),
      subjectId: new mongoose.Types.ObjectId(subjectId),
      teacherId: new mongoose.Types.ObjectId(teacherId),
      isActive: true
    });

    if (!assigned) {
      return res.status(403).json({
        message: "You are not assigned to this class & subject"
      });
    }

    const assignment = await Assignment.create({
      classId,
      subjectId,
      teacherId,
      title,
      description,
      dueDate,
      totalMarks: type === "assignment" ? totalMarks : null,
      type,
      createdBy: teacherId
    });

    res.status(201).json({
      message: "Assignment created successfully",
      assignment
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Check assignment
const checkAssignment = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { submissionId, marksObtained } = req.body;

    const submission = await AssignmentSubmission.findById(submissionId)
      .populate("assignmentId");

    if (!submission) {
      return res.status(404).json({ message: "Submission not found" });
    }

    if (submission.assignmentId.teacherId.toString() !== teacherId) {
      return res.status(403).json({ message: "Access denied" });
    }

    submission.marksObtained = marksObtained;
    submission.status = "checked";
    await submission.save();

    res.json({ message: "Assignment checked successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Get students of class
const getStudentsOfClass = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { classId } = req.params;

    const assigned = await ClassSubject.findOne({
      classId,
      teacherId,
      isActive: true
    });

    if (!assigned) {
      return res.status(403).json({
        message: "You are not assigned to this class"
      });
    }

    const students = await ClassStudent.find({
      classId,
      isActive: true
    }).populate("studentId", "name rollNo email");

    res.json({ total: students.length, students });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Get assignment submissions
const getAssignmentSubmissions = async (req, res) => {
  try {
    const { assignmentId } = req.query;
    const teacherId = req.user.id;

    const submissions = await AssignmentSubmission.find({ assignmentId })
      .populate("studentId", "name rollNo")
      .populate({
        path: "assignmentId",
        match: { teacherId }
      });

    const filtered = submissions.filter(s => s.assignmentId !== null);

    res.json({ submissions: filtered });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

/* ============ NEW MISSING FUNCTIONS ============ */

// Get all assignments for a class/subject (for listing)
const getAssignments = async (req, res) => {
  try {
    const { classId, subjectId } = req.query;
    const teacherId = req.user.id;

    const assignments = await Assignment.find({
      classId,
      subjectId,
      teacherId,
      isActive: true
    }).sort({ createdAt: -1 });

    res.json({ assignments });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Update assignment
const updateAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const teacherId = req.user.id;
    const { title, description, dueDate, totalMarks, type } = req.body;

    const assignment = await Assignment.findOne({
      _id: id,
      teacherId
    });

    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    if (title) assignment.title = title;
    if (description) assignment.description = description;
    if (dueDate) assignment.dueDate = dueDate;
    if (totalMarks !== undefined) assignment.totalMarks = totalMarks;
    if (type) assignment.type = type;

    await assignment.save();

    res.json({ message: "Assignment updated successfully", assignment });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Delete assignment (soft delete)
const deleteAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const teacherId = req.user.id;

    const assignment = await Assignment.findOneAndUpdate(
      { _id: id, teacherId },
      { isActive: false },
      { new: true }
    );

    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    res.json({ message: "Assignment deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Get student attendance for a specific student
const getStudentAttendance = async (req, res) => {
  try {
    const { studentId, classId } = req.query;
    const teacherId = req.user.id;

    // Verify teacher teaches this class
    const assigned = await ClassSubject.findOne({
      classId,
      teacherId,
      isActive: true
    });

    if (!assigned) {
      return res.status(403).json({ message: "Access denied" });
    }

    const attendance = await Attendance.find({
      studentId,
      classId
    })
      .populate("subjectId", "name")
      .sort({ date: -1 });

    res.json({ attendance });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Get student submissions
const getStudentSubmissions = async (req, res) => {
  try {
    const { studentId, classId } = req.query;
    const teacherId = req.user.id;

    // Verify teacher teaches this class
    const assigned = await ClassSubject.findOne({
      classId,
      teacherId,
      isActive: true
    });

    if (!assigned) {
      return res.status(403).json({ message: "Access denied" });
    }

    const submissions = await AssignmentSubmission.find({ studentId })
      .populate({
        path: "assignmentId",
        populate: { path: "subjectId", select: "name" }
      })
      .sort({ submittedAt: -1 });

    res.json({ submissions });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Get teacher profile
const getTeacherProfile = async (req, res) => {
  try {
    const teacherId = req.user.id;

    const teacher = await User.findById(teacherId).select("-password");

    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    res.json({ user: teacher });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Update teacher profile
const updateTeacherProfile = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { name, gender, Dob, subject, assignedClass } = req.body;

    const teacher = await User.findById(teacherId);

    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    if (name) teacher.name = name;
    if (gender) teacher.gender = gender;
    if (Dob) teacher.Dob = Dob;
    if (subject) teacher.subject = subject;
    if (assignedClass) teacher.assignedClass = assignedClass;

    await teacher.save();

    res.json({ message: "Profile updated successfully", user: teacher });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Change teacher password
const changeTeacherPassword = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const teacher = await User.findById(teacherId);

    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    const isMatch = await bcrypt.compare(currentPassword, teacher.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    teacher.password = hashedPassword;
    await teacher.save();

    res.json({ message: "Password changed successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Get teacher's classes and subjects for dropdown
const getTeacherClassesSubjects = async (req, res) => {
  try {
    const teacherId = req.user.id;

    const assignments = await ClassSubject.find({
      teacherId,
      isActive: true
    })
      .populate("classId", "className section")
      .populate("subjectId", "name code");

    res.json({
      total: assignments.length,
      assignments
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Create a new test/marks entry
const createTest = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { classId, subjectId, testName, description, testDate, maxMarks } = req.body;

    console.log("Create test request:", { teacherId, classId, subjectId, testName });

    if (!classId || !subjectId || !testName || !maxMarks) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    // Check teacher assignment
    const assignment = await ClassSubject.findOne({
      classId: new mongoose.Types.ObjectId(classId),
      subjectId: new mongoose.Types.ObjectId(subjectId),
      teacherId: new mongoose.Types.ObjectId(teacherId),
      isActive: true
    });

    if (!assignment) {
      return res.status(403).json({
        message: "You are not assigned to this class and subject"
      });
    }

    const test = await Marks.create({
      classId, subjectId, teacherId, testName, description: description || "", testDate: testDate || new Date(), maxMarks, createdBy: teacherId
    });

    console.log("Test created:", test._id);

    res.status(201).json({
      message: "Test created successfully",
      test
    });
  } catch (error) {
    console.error("Error creating test:", error);
    res.status(500).json({ message: "Server error: " + error.message });
  }
};

// Get all tests for a class and subject
const getTests = async (req, res) => {
  try {
    const { classId, subjectId } = req.query;
    const teacherId = req.user.id;

    const tests = await Marks.find({
      classId,
      subjectId,
      teacherId,
      isActive: true
    }).sort({ testDate: -1 });

    res.json({ tests });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Get students for a class to enter marks
const getStudentsForMarks = async (req, res) => {
  try {
    const { classId } = req.params;
    const teacherId = req.user.id;

    // Check if teacher is assigned to this class
    const assigned = await ClassSubject.findOne({
      classId,
      teacherId,
      isActive: true
    });

    if (!assigned) {
      return res.status(403).json({
        message: "You are not assigned to this class"
      });
    }

    const students = await ClassStudent.find({
      classId,
      isActive: true
    }).populate("studentId", "name rollNo email");

    res.json({ 
      total: students.length, 
      students: students.map(s => s.studentId) 
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Save marks for students
const saveMarks = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { testId, marks } = req.body; // marks is array of { studentId, marksObtained, remarks }

    if (!testId || !marks || !marks.length) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    // Verify test belongs to teacher
    const test = await Marks.findOne({
      _id: testId,
      teacherId,
      isActive: true
    });

    if (!test) {
      return res.status(404).json({ message: "Test not found" });
    }

    // Save marks for each student
    const savedMarks = await Promise.all(
      marks.map(async (m) => {
        const studentMark = await StudentMarks.findOneAndUpdate(
          { marksId: testId, studentId: m.studentId },
          {
            marksId: testId,
            studentId: m.studentId,
            marksObtained: m.marksObtained,
            remarks: m.remarks || "",
            createdBy: teacherId
          },
          { upsert: true, new: true }
        );
        return studentMark;
      })
    );

    res.json({
      message: "Marks saved successfully",
      count: savedMarks.length
    });
  } catch (error) {
    console.error("Error saving marks:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get marks for a specific test
const getTestMarks = async (req, res) => {
  try {
    const { testId } = req.params;
    const teacherId = req.user.id;

    // Verify test belongs to teacher
    const test = await Marks.findOne({
      _id: testId,
      teacherId,
      isActive: true
    });

    if (!test) {
      return res.status(404).json({ message: "Test not found" });
    }

    const marks = await StudentMarks.find({ 
      marksId: testId,
      isActive: true 
    }).populate("studentId", "name rollNo email");

    res.json({
      test,
      marks
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Update a test
const updateTest = async (req, res) => {
  try {
    const { id } = req.params;
    const teacherId = req.user.id;
    const { testName, description, testDate, maxMarks } = req.body;

    const test = await Marks.findOne({
      _id: id,
      teacherId
    });

    if (!test) {
      return res.status(404).json({ message: "Test not found" });
    }

    if (testName) test.testName = testName;
    if (description !== undefined) test.description = description;
    if (testDate) test.testDate = testDate;
    if (maxMarks) test.maxMarks = maxMarks;

    await test.save();

    res.json({ message: "Test updated successfully", test });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Delete a test (soft delete)
const deleteTest = async (req, res) => {
  try {
    const { id } = req.params;
    const teacherId = req.user.id;

    const test = await Marks.findOneAndUpdate(
      { _id: id, teacherId },
      { isActive: false },
      { new: true }
    );

    if (!test) {
      return res.status(404).json({ message: "Test not found" });
    }

    // Also soft delete all student marks for this test
    await StudentMarks.updateMany(
      { marksId: id },
      { isActive: false }
    );

    res.json({ message: "Test deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { getTeacherAssignments, markAttendance, getAttendanceByClass, editAttendance, createAssignment, checkAssignment, getStudentsOfClass, getAssignmentSubmissions, getAssignments, updateAssignment, deleteAssignment, getStudentAttendance, getStudentSubmissions, getTeacherProfile, updateTeacherProfile, changeTeacherPassword, getTeacherClassesSubjects, createTest, getTests, getStudentsForMarks, saveMarks, getTestMarks, updateTest, deleteTest };