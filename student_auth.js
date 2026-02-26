const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { 
  ClassSubject, AssignmentSubmission, Assignment, 
  ClassStudent, Attendance, User, Marks, StudentMarks,
  FeeStructure, StudentFee 
} = require("./models");

// Student View their class
const getMyClass = async (req, res) => {
  try {
    const studentId = req.user.id;

    const data = await ClassStudent.findOne({
      studentId,
      isActive: true
    }).populate("classId", "className section classTeacher")
      .populate({
        path: "classId",
        populate: { path: "classTeacher", select: "name email" }
      });

    if (!data) {
      return res.status(404).json({ message: "Class not assigned" });
    }

    res.json({ class: data.classId });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Student View their subject teacher
const getMySubjects = async (req, res) => {
  try {
    const studentId = req.user.id;

    const mapping = await ClassStudent.findOne({
      studentId,
      isActive: true
    });

    if (!mapping) {
      return res.status(404).json({ message: "Class not assigned" });
    }

    const subjects = await ClassSubject.find({
      classId: mapping.classId,
      isActive: true
    })
      .populate("subjectId", "name code")
      .populate("teacherId", "name email");

    res.json({
      total: subjects.length,
      subjects
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Student View their Attendance
const getMyAttendance = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { subjectId, month } = req.query;

    let query = { studentId };
    if (subjectId) query.subjectId = subjectId;
    
    if (month) {
      const startDate = new Date(month + "-01");
      const endDate = new Date(new Date(startDate).setMonth(startDate.getMonth() + 1));
      query.date = { $gte: startDate, $lt: endDate };
    }

    const attendance = await Attendance.find(query)
      .populate("subjectId", "name code")
      .sort({ date: -1 });

    const stats = {
      present: attendance.filter(a => a.status === "present").length,
      absent: attendance.filter(a => a.status === "absent").length,
      total: attendance.length,
      percentage: attendance.length > 0 
        ? ((attendance.filter(a => a.status === "present").length / attendance.length) * 100).toFixed(1)
        : 0
    };

    res.json({
      total: attendance.length,
      stats,
      attendance
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Student View attendance summary
const getStudentAttendanceSummary = async (req, res) => {
  try {
    const studentId = req.user.id;

    const records = await Attendance.find({ studentId })
      .populate("subjectId", "name code");

    const subjectWise = [];

    records.forEach((r) => {
      const subjectId = r.subjectId._id.toString();
      const subjectName = r.subjectId.name;
      
      if (!subjectWise[subjectId]) {
        subjectWise[subjectId] = { 
          subjectId, 
          subjectName,
          present: 0, 
          absent: 0,
          total: 0 
        };
      }
      subjectWise[subjectId].total += 1;
      if (r.status === "present") {
        subjectWise[subjectId].present += 1;
      } else {
        subjectWise[subjectId].absent += 1;
      }
    });

    // Calculate percentages
    Object.keys(subjectWise).forEach(key => {
      const item = subjectWise[key];
      item.percentage = ((item.present / item.total) * 100).toFixed(1);
    });

    res.json({ 
      summary: Object.values(subjectWise),
      totalRecords: records.length 
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Student View Their Assignments (includes both homework and assignments)
const getMyAssignments = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { status, type } = req.query; // type can be 'all', 'assignment', 'homework'

    const mapping = await ClassStudent.findOne({
      studentId,
      isActive: true
    });

    if (!mapping) {
      return res.status(404).json({ message: "Class not assigned" });
    }

    // Build query based on type filter
    let query = {
      classId: mapping.classId,
      isActive: true
    };
    
    if (type && type !== 'all') {
      query.type = type;
    }

    const assignments = await Assignment.find(query)
      .populate("subjectId", "name code")
      .populate("teacherId", "name")
      .sort({ dueDate: 1 });

    // Get student's submissions
    const submissions = await AssignmentSubmission.find({ studentId });
    
    // Enhance assignments with submission status
    const enhancedAssignments = assignments.map(assignment => {
      const submission = submissions.find(s => 
        s.assignmentId.toString() === assignment._id.toString()
      );
      
      let assignmentStatus = 'pending';
      if (submission) {
        assignmentStatus = submission.status; // 'submitted' or 'checked'
      }

      return {
        ...assignment.toObject(),
        submissionStatus: assignmentStatus,
        submission: submission || null,
        type: assignment.type // 'homework' or 'assignment'
      };
    });

    // Filter by status if requested
    let filteredAssignments = enhancedAssignments;
    if (status) {
      const today = new Date().toISOString().split('T')[0];
      if (status === 'pending') {
        filteredAssignments = enhancedAssignments.filter(a => 
          a.submissionStatus === 'pending' && a.dueDate >= today
        );
      } else if (status === 'overdue') {
        filteredAssignments = enhancedAssignments.filter(a => 
          a.submissionStatus === 'pending' && a.dueDate < today
        );
      } else {
        filteredAssignments = enhancedAssignments.filter(a => a.submissionStatus === status);
      }
    }

    res.json({
      total: filteredAssignments.length,
      assignments: filteredAssignments
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Assignment submission
const submitAssignment = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { assignmentId, submissionText } = req.body;

    if (!assignmentId || !submissionText) {
      return res.status(400).json({ message: "Required data missing" });
    }

    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    // Check student belongs to class
    const mapping = await ClassStudent.findOne({
      classId: assignment.classId,
      studentId,
      isActive: true
    });

    if (!mapping) {
      return res.status(403).json({
        message: "You are not part of this class"
      });
    }

    // Check if assignment is overdue
    const today = new Date().toISOString().split('T')[0];
    if (assignment.dueDate < today) {
      return res.status(400).json({ 
        message: "Assignment due date has passed" 
      });
    }

    const submission = await AssignmentSubmission.create({
      assignmentId,
      studentId,
      submissionText,
      createdBy: studentId
    });

    res.status(201).json({
      message: "Assignment submitted successfully",
      submission
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        message: "Assignment already submitted"
      });
    }
    res.status(500).json({ message: "Server error" });
  }
};

// Student View their submissions
const getMySubmissions = async (req, res) => {
  try {
    const studentId = req.user.id;

    const submissions = await AssignmentSubmission.find({ studentId })
      .populate({
        path: "assignmentId",
        populate: [
          { path: "subjectId", select: "name code" },
          { path: "teacherId", select: "name" }
        ]
      })
      .sort({ createdAt: -1 });

    res.json({
      total: submissions.length,
      submissions
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Student View Their Assignment Marks (from submissions)
const getMyAssignmentMarks = async (req, res) => {
  try {
    const studentId = req.user.id;

    const submissions = await AssignmentSubmission.find({
      studentId,
      status: "checked"
    }).populate({
      path: "assignmentId",
      populate: { path: "subjectId", select: "name code" }
    });

    // Calculate subject-wise marks
    const subjectMarks = {};
    submissions.forEach(sub => {
      const subjectName = sub.assignmentId.subjectId.name;
      const subjectId = sub.assignmentId.subjectId._id;
      
      if (!subjectMarks[subjectId]) {
        subjectMarks[subjectId] = {
          subjectId,
          subjectName,
          totalMarks: 0,
          obtainedMarks: 0,
          count: 0,
          assignments: []
        };
      }
      
      subjectMarks[subjectId].totalMarks += sub.assignmentId.totalMarks;
      subjectMarks[subjectId].obtainedMarks += sub.marksObtained;
      subjectMarks[subjectId].count += 1;
      subjectMarks[subjectId].assignments.push({
        title: sub.assignmentId.title,
        obtained: sub.marksObtained,
        total: sub.assignmentId.totalMarks,
        type: sub.assignmentId.type
      });
    });

    // Calculate percentages
    Object.keys(subjectMarks).forEach(key => {
      const item = subjectMarks[key];
      item.percentage = ((item.obtainedMarks / item.totalMarks) * 100).toFixed(1);
    });

    res.json({
      totalChecked: submissions.length,
      subjectWise: Object.values(subjectMarks),
      submissions
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// NEW: Student View Their Test Marks (from Marks model)
const getMyTestMarks = async (req, res) => {
  try {
    const studentId = req.user.id;

    // Get all tests for student's class
    const classInfo = await ClassStudent.findOne({ studentId, isActive: true });
    
    if (!classInfo) {
      return res.status(404).json({ message: "Class not assigned" });
    }

    // Get all tests for this class
    const tests = await Marks.find({
      classId: classInfo.classId,
      isActive: true
    }).populate("subjectId", "name code")
      .populate("teacherId", "name")
      .sort({ testDate: -1 });

    // Get student's marks for these tests
    const testMarks = await StudentMarks.find({
      studentId,
      isActive: true
    });

    // Combine test info with marks
    const enhancedTests = tests.map(test => {
      const mark = testMarks.find(m => m.marksId.toString() === test._id.toString());
      return {
        ...test.toObject(),
        marksObtained: mark?.marksObtained || null,
        remarks: mark?.remarks || "",
        isMarked: !!mark
      };
    });

    // Calculate statistics
    const totalTests = tests.length;
    const markedTests = testMarks.length;
    const totalMarks = tests.reduce((sum, t) => sum + t.maxMarks, 0);
    const obtainedMarks = testMarks.reduce((sum, m) => sum + m.marksObtained, 0);
    const percentage = totalMarks > 0 ? ((obtainedMarks / totalMarks) * 100).toFixed(1) : 0;

    res.json({
      totalTests,
      markedTests,
      totalMarks,
      obtainedMarks,
      percentage,
      tests: enhancedTests
    });
  } catch (error) {
    console.error("Error fetching test marks:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get Student Profile
const getStudentProfile = async (req, res) => {
  try {
    const studentId = req.user.id;
    
    const student = await User.findById(studentId).select("-password");
    
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }
    
    // Get class information
    const classInfo = await ClassStudent.findOne({ 
      studentId, 
      isActive: true 
    }).populate("classId", "className section");
    
    res.json({ 
      user: student,
      classInfo: classInfo?.classId || null
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Update Student Profile
const updateStudentProfile = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { name, gender, Dob } = req.body;
    
    const student = await User.findById(studentId);
    
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }
    
    if (name) student.name = name;
    if (gender) student.gender = gender;
    if (Dob) student.Dob = Dob;
    
    await student.save();
    
    res.json({ 
      message: "Profile updated successfully", 
      user: student 
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Change Student Password
const changeStudentPassword = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "All fields are required" });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ 
        message: "Password must be at least 6 characters" 
      });
    }
    
    const student = await User.findById(studentId);
    
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }
    
    const isMatch = await bcrypt.compare(currentPassword, student.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }
    
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    student.password = hashedPassword;
    await student.save();
    
    res.json({ message: "Password changed successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Get Student Dashboard Data
const getStudentDashboard = async (req, res) => {
  try {
    const studentId = req.user.id;

    // Get class info
    const classMapping = await ClassStudent.findOne({ 
      studentId, 
      isActive: true 
    }).populate("classId", "className section");

    if (!classMapping) {
      return res.status(404).json({ message: "Class not assigned" });
    }

    // Get attendance summary
    const attendance = await Attendance.find({ studentId });
    const attendanceStats = {
      present: attendance.filter(a => a.status === "present").length,
      absent: attendance.filter(a => a.status === "absent").length,
      total: attendance.length,
      percentage: attendance.length > 0 
        ? ((attendance.filter(a => a.status === "present").length / attendance.length) * 100).toFixed(1)
        : 0
    };

    // Get assignments count
    const assignments = await Assignment.find({
      classId: classMapping.classId._id,
      isActive: true
    });

    // Get submissions
    const submissions = await AssignmentSubmission.find({ studentId });
    const submittedCount = submissions.length;
    const checkedCount = submissions.filter(s => s.status === "checked").length;

    // Get tests count
    const tests = await Marks.find({
      classId: classMapping.classId._id,
      isActive: true
    });

    // Get test marks
    const testMarks = await StudentMarks.find({ studentId });

    // Get subjects count
    const subjects = await ClassSubject.countDocuments({
      classId: classMapping.classId._id,
      isActive: true
    });

    res.json({
      classInfo: classMapping.classId,
      stats: {
        attendance: attendanceStats,
        totalSubjects: subjects,
        totalAssignments: assignments.length,
        submittedAssignments: submittedCount,
        checkedAssignments: checkedCount,
        totalTests: tests.length,
        markedTests: testMarks.length
      },
      recentAttendance: attendance.slice(0, 5),
      recentAssignments: assignments.slice(0, 3),
      recentTests: tests.slice(0, 3)
    });

  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Get Fee Details for Student
const getMyFees = async (req, res) => {
  try {
    const studentId = req.user.id;

    const feeRecord = await StudentFee.findOne({ 
      studentId,
      status: { $in: ["unpaid", "partial"] }
    }).populate("classId", "className section");

    if (!feeRecord) {
      return res.json({ 
        message: "No pending fees",
        feeRecord: null 
      });
    }

    // Get payment history
    const payments = await FeePayment.find({ 
      studentFeeId: feeRecord._id 
    }).sort({ paymentDate: -1 });

    res.json({
      feeRecord,
      payments,
      dueAmount: feeRecord.dueAmount,
      paidAmount: feeRecord.paidAmount,
      totalFee: feeRecord.totalFee,
      status: feeRecord.status
    });

  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { 
  getMyClass, getMySubjects, getMyAttendance, getStudentAttendanceSummary,
  getMyAssignments, submitAssignment, getMySubmissions, getMyAssignmentMarks,
  getMyTestMarks, getStudentProfile, updateStudentProfile, changeStudentPassword,
  getStudentDashboard, getMyFees
};