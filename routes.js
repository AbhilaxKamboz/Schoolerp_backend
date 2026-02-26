const express = require("express");
const router = express.Router();
// Admin Auth
const { createAdmin, loginUser, createUser, getEnhancedAdminDashboard, getUsers, updateUserStatus, updateUserProfile, changeUserPassword, createClass, getAllClasses, createSubject, getAllSubjects, assignSubjectToClass, getSubjectsByClass, assignStudentToClass, getStudentsByClass, getClassAttendanceReport, getAssignmentPerformance, updateClass, updateClassStatus, updateSubject, updateSubjectStatus, getAvailableClasses, getAdminProfile, updateAdminProfile, changeAdminPassword, updateSubjectAssignment, deleteSubjectAssignment, getAllTeachers } = require("./auth");

// Teacher Auth
const {getTeacherAssignments, markAttendance, getAttendanceByClass, editAttendance, createAssignment, checkAssignment, getStudentsOfClass, getAssignmentSubmissions, getAssignments, updateAssignment, deleteAssignment, getStudentAttendance, getStudentSubmissions, getTeacherProfile, updateTeacherProfile, changeTeacherPassword,  getTeacherClassesSubjects, createTest, getTests, getStudentsForMarks, saveMarks, getTestMarks, updateTest, deleteTest } = require("./teacher_auth");

//Student Auth
const { submitAssignment, getMyClass, getMySubjects, getMyAttendance, getStudentAttendanceSummary, getMyAssignments, getMySubmissions, getStudentProfile, updateStudentProfile, changeStudentPassword,
  getStudentDashboard, getMyFees, getMyAssignmentMarks, getMyTestMarks } = require("./student_auth");

const { 
  createFeeStructure, getFeeStructures, updateFeeStructure, deleteFeeStructure, assignFeeToStudent, 
  getStudentFees, getStudentFeeDetails, receiveFeePayment, getPaymentHistory, getFeeStatistics,
  getDueFees, getFeeReport, getAccountantProfile, updateAccountantProfile, changeAccountantPassword, getClasses, getStudentsByClassaccount
} = require("./accountant_auth");

// Middleware
const {roleAuth }=require("./middleware");

router.post("/admin/create", createAdmin);
router.post("/login", loginUser);

// Protected Test Route
router.get("/admin/dashboard", roleAuth(["admin"]), (req, res) => {
  res.json({
    message: "Welcome Admin",
    admin: req.user
  });
});

// Admin -> Users Route
router.post("/admin/user/create",roleAuth(["admin","accountant"]), createUser)
router.get("/admin/dashboard-data",roleAuth(["admin"]) , getEnhancedAdminDashboard);
router.get("/admin/users",roleAuth(["admin"]), getUsers);
router.put("/admin/user/status/:id",roleAuth(["admin"]),updateUserStatus);
router.put("/admin/user/profile/:id",roleAuth(["admin"]), updateUserProfile);
router.put("/admin/user/change-password/:id",roleAuth(["admin"]), changeUserPassword);

// Admin -> Create/get class
router.post("/admin/class/create",roleAuth(["admin","accountant"]), createClass);

router.get("/admin/classes", roleAuth(["admin"]), getAllClasses);

// Admin -> create/get subjects 
router.post("/admin/subject/create",roleAuth(["admin","accountant"]),createSubject);

router.get("/admin/subjects", roleAuth(["admin"]), getAllSubjects);

// Admin -> Assign subject to class / Get all assigned subjects
router.post("/admin/class-subject/assign",roleAuth(["admin", "accountant"]),assignSubjectToClass);

router.get("/admin/class/:classId/subjects",roleAuth(["admin"]),getSubjectsByClass);

// Admin -> Assign students to class/get all assigned class
router.post("/admin/class-student/assign",roleAuth(["admin", "accountant"]), assignStudentToClass);

router.get("/admin/class/:classId/students",roleAuth(["admin"]), getStudentsByClass);

// Admin View all Attendance of particular class
router.get("/admin/attendance/class",roleAuth(["admin"]),getClassAttendanceReport);

// Admin view all assignment report
router.get("/admin/assignment/report",roleAuth(["admin"]),getAssignmentPerformance);

router.put("/admin/class/:id", roleAuth(["admin"]), updateClass);
router.put("/admin/class/status/:id", roleAuth(["admin"]), updateClassStatus);
router.put("/admin/subject/:id", roleAuth(["admin"]), updateSubject);
router.put("/admin/subject/status/:id", roleAuth(["admin"]), updateSubjectStatus);
router.get("/admin/available-classes", roleAuth(["admin"]), getAvailableClasses);
// Admin Profile Routes
router.get("/admin/profile", roleAuth(["admin"]), getAdminProfile);
router.put("/admin/profile", roleAuth(["admin"]), updateAdminProfile);
router.put("/admin/change-password", roleAuth(["admin"]), changeAdminPassword);
// Get all active teachers
router.get("/admin/teachers", roleAuth(["admin"]), getAllTeachers);
router.put("/admin/class-subject/:id", roleAuth(["admin"]), updateSubjectAssignment);
router.delete("/admin/class-subject/:id", roleAuth(["admin"]), deleteSubjectAssignment);

/* TEACHER ROUTES  */

// Teacher assignments (classes they teach)
router.get("/teacher/assignments", roleAuth(["teacher"]), getTeacherAssignments);

// Attendance management
router.post("/teacher/attendance/mark", roleAuth(["teacher"]), markAttendance);
router.get("/teacher/attendance", roleAuth(["teacher"]), getAttendanceByClass);
router.put("/teacher/attendance/edit", roleAuth(["teacher"]), editAttendance);

// Assignment management
router.post("/teacher/assignment/create", roleAuth(["teacher"]), createAssignment);
router.put("/teacher/assignment/check", roleAuth(["teacher"]), checkAssignment);
router.get("/teacher/assignment/list", roleAuth(["teacher"]), getAssignments);
router.put("/teacher/assignment/:id", roleAuth(["teacher"]), updateAssignment);
router.delete("/teacher/assignment/:id", roleAuth(["teacher"]), deleteAssignment);
router.get("/teacher/assignment/submissions", roleAuth(["teacher"]), getAssignmentSubmissions);

// Student management
router.get("/teacher/class/:classId/students", roleAuth(["teacher"]), getStudentsOfClass);
router.get("/teacher/student/attendance", roleAuth(["teacher"]), getStudentAttendance);
router.get("/teacher/student/submissions", roleAuth(["teacher"]), getStudentSubmissions);

// Student marks
router.get("/teacher/classes-subjects", roleAuth(["teacher"]), getTeacherClassesSubjects);
router.post("/teacher/test/create", roleAuth(["teacher"]), createTest);
router.get("/teacher/tests", roleAuth(["teacher"]), getTests);
router.get("/teacher/test/:testId/marks", roleAuth(["teacher"]), getTestMarks);
router.get("/teacher/class/:classId/students", roleAuth(["teacher"]), getStudentsForMarks);
router.post("/teacher/marks/save", roleAuth(["teacher"]), saveMarks);
router.put("/teacher/test/:id", roleAuth(["teacher"]), updateTest);
router.delete("/teacher/test/:id", roleAuth(["teacher"]), deleteTest);

// Teacher profile
router.get("/teacher/profile", roleAuth(["teacher"]), getTeacherProfile);
router.put("/teacher/profile", roleAuth(["teacher"]), updateTeacherProfile);
router.put("/teacher/change-password", roleAuth(["teacher"]), changeTeacherPassword);

/* STUDENT ROUTES  */

// Dashboard
router.get("/student/dashboard", roleAuth(["student"]), getStudentDashboard);

// Profile Management
router.get("/student/profile", roleAuth(["student"]), getStudentProfile);
router.put("/student/profile", roleAuth(["student"]), updateStudentProfile);
router.put("/student/change-password", roleAuth(["student"]), changeStudentPassword);

// Class Information
router.get("/student/my-class", roleAuth(["student"]), getMyClass);
router.get("/student/my-subjects", roleAuth(["student"]), getMySubjects);

// Attendance
router.get("/student/my-attendance", roleAuth(["student"]), getMyAttendance);
router.get("/student/attendance-summary", roleAuth(["student"]), getStudentAttendanceSummary);

// Assignments (includes both homework and assignments)
router.get("/student/my-assignments", roleAuth(["student"]), getMyAssignments);
router.post("/student/assignment/submit", roleAuth(["student"]), submitAssignment);
router.get("/student/my-submissions", roleAuth(["student"]), getMySubmissions);

// Marks (from assignments and tests)
router.get("/student/assignment-marks", roleAuth(["student"]), getMyAssignmentMarks);
router.get("/student/test-marks", roleAuth(["student"]), getMyTestMarks);

// Fees
router.get("/student/my-fees", roleAuth(["student"]), getMyFees);

/*  ACCOUNTANT ROUTES  */

// Dashboard & Statistics
router.get("/accountant/dashboard", roleAuth(["accountant"]), getFeeStatistics);

// Fee Structure Management
router.post("/accountant/fee-structure/create", roleAuth(["accountant"]), createFeeStructure);
router.get("/accountant/fee-structures", roleAuth(["accountant"]), getFeeStructures);
router.put("/accountant/fee-structure/:id", roleAuth(["accountant"]), updateFeeStructure);
router.delete("/accountant/fee-structure/:id", roleAuth(["accountant"]), deleteFeeStructure);

// Student Fee Management
router.post("/accountant/student-fee/assign", roleAuth(["accountant"]), assignFeeToStudent);
router.get("/accountant/student-fees", roleAuth(["accountant"]), getStudentFees);
router.get("/accountant/student-fee/:studentId", roleAuth(["accountant"]), getStudentFeeDetails);

// Payment Management
router.post("/accountant/fee/payment", roleAuth(["accountant"]), receiveFeePayment);
router.get("/accountant/payments", roleAuth(["accountant"]), getPaymentHistory);

// Reports
router.get("/accountant/due-fees", roleAuth(["accountant"]), getDueFees);
router.get("/accountant/fee-report", roleAuth(["accountant"]), getFeeReport);

// Profile Management
router.get("/accountant/profile", roleAuth(["accountant"]), getAccountantProfile);
router.put("/accountant/profile", roleAuth(["accountant"]), updateAccountantProfile);
router.put("/accountant/change-password", roleAuth(["accountant"]), changeAccountantPassword);

// Helper Routes (Dropdowns)
router.get("/accountant/classes", roleAuth(["accountant"]), getClasses);
router.get("/accountant/class/:classId/students", roleAuth(["accountant"]), getStudentsByClassaccount);

module.exports = router;
