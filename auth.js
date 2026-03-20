const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { User, Class, Subject, ClassSubject, ClassStudent, Attendance, Assignment, Homework, FeeStructure } = require("./models");

const createAdmin = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existingAdmin = await User.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({ message: "Admin already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = await User.create({
      name, email, password: hashedPassword, role: "admin"
    });

    res.status(201).json({
      message: "Admin created successfully",
      admin
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Login user
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email, isActive: true });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Create User (Common for all roles)
const createUser = async (req, res) => {
  try {
    const {
      name, email, password, role, gender, subject, assignedClass, 
      className: reqClassName, section: reqSection, rollNo, admissionNo, 
      Dob, classId, qualification, employeeId, joiningDate 
    } = req.body;

    // 1. Basic validation
    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    // 2. Check existing user
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // 3. Role-based validation
    if (role === "teacher") {
      if (!subject || !assignedClass) {
        return res.status(400).json({
          message: "Subject and class are required for teacher"
        });
      }
    }

    // Initialize variables for class name and section
    let className = reqClassName;
    let section = reqSection;

    // Student validation
    if (role === "student") {
      if (!classId || !rollNo || !admissionNo) {
        return res.status(400).json({
          message: "Class, roll number and admission number are required for student"
        });
      }
      
      const classData = await Class.findById(classId);
      if (!classData) {
        return res.status(400).json({
          message: "Selected class not found"
        });
      }
      
      className = classData.className;
      section = classData.section;
    }

    // 4. Encrypt password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 5. Create user object
    const userData = {
      name, 
      email, 
      password: hashedPassword, 
      role,
      isActive: true, 
      gender, 
      Dob, 
      createdBy: req.user.id,
      
      // Common fields for all staff (teacher, librarian, accountant etc.)
      qualification: qualification || undefined,
      employeeId: employeeId || undefined,
      joiningDate: joiningDate || undefined
    };

    // 6. Attach role-specific fields
    if (role === "teacher") {
      userData.subject = subject;
      userData.assignedClass = assignedClass;
    }

    if (role === "student") {
      userData.className = className;
      userData.section = section;
      userData.rollNo = rollNo;
      userData.admissionNo = admissionNo;
    }

    const user = await User.create(userData);

    // Student mapping to class
    if (role === "student") {
      await ClassStudent.create({
        classId,
        studentId: user._id,
        createdBy: req.user.id
      });
    }

    res.status(201).json({
      message: `${role} created successfully`,
      user
    });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Admin DashBoard
const getAdminDashboard = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalTeachers = await User.countDocuments({ role: "teacher" });
    const totalAdmins = await User.countDocuments({ role: "admin" });
    const totalStudents = await User.countDocuments({ role: "student" });

    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select("name email role createdAt");

    res.json({
      totalUsers, totalTeachers, totalStudents, totalAdmins, recentUsers
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

//Admin See All Users
const getUsers = async (req, res) => {
  try {
    const { role, isActive } = req.query;

    const filter = {};

    if (role) filter.role = role;
    if (isActive !== undefined) filter.isActive = isActive === "true";

    const users = await User.find(filter)
      .select("-password") 
      .sort({ createdAt: -1 });

    res.json({
      total: users.length,
      users
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Update user Status (Activate / Deactivate)
const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        message: "isActive must be true or false"
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.isActive = isActive;
    await user.save();

    res.json({
      message: `User ${isActive ? "activated" : "deactivated"} successfully`
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Update user details
const updateUserProfile = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const {
      name,
      gender,
      Dob,

      // teacher
      subject,
      assignedClass,

      // student
      className,
      section,
      rollNo,
      admissionNo,
      
      // common fields
      qualification,
      employeeId,
      joiningDate
    } = req.body;

    // Common fields
    if (name) user.name = name;
    if (gender) user.gender = gender;
    if (Dob) user.Dob = Dob;

    //  common fields
    if (qualification !== undefined) user.qualification = qualification;
    if (employeeId !== undefined) user.employeeId = employeeId;
    if (joiningDate !== undefined) user.joiningDate = joiningDate;

    // Role-based updates
    if (user.role === "teacher") {
      if (subject) user.subject = subject;
      if (assignedClass) user.assignedClass = assignedClass;
    }

    if (user.role === "student") {
      if (className) user.className = className;
      if (section) user.section = section;
      if (rollNo) user.rollNo = rollNo;
      if (admissionNo) user.admissionNo = admissionNo;
    }

    await user.save();

    res.json({
      message: "User profile updated successfully",
      user
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Update Teacher Password
const changeUserPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters"
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;

    await user.save();

    res.json({ message: "Password updated successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Create Class
const createClass = async (req, res) => {
  try {
    const { className, section } = req.body;

    if (!className || !section) {
      return res.status(400).json({
        message: "Class name and section are required"
      });
    }

    const newClass = await Class.create({
      className,
      section,
      createdBy: req.user.id
    });

    res.status(201).json({
      message: "Class created successfully",
      class: newClass
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        message: "Class with this section already exists"
      });
    }
    res.status(500).json({ message: "Server error" });
  }
};

// Get all classes
const getAllClasses = async (req, res) => {
  try {
    const classes = await Class.find()
      .populate("classTeacher", "name email")
      .sort({ createdAt: -1 });

    res.json({
      total: classes.length,
      classes
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Create subjects

const createSubject = async (req, res) => {
  try {
    const { name, code } = req.body;

    if (!name || !code) {
      return res.status(400).json({
        message: "Subject name and code are required"
      });
    }

    const subject = await Subject.create({
      name,
      code,
      createdBy: req.user.id
    });

    res.status(201).json({
      message: "Subject created successfully",
      subject
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        message: "Subject name or code already exists"
      });
    }
    res.status(500).json({ message: "Server error" });
  }
};

// Get all subjects
const getAllSubjects = async (req, res) => {
  try {
    const subjects = await Subject.find()
      .sort({ createdAt: -1 });

    res.json({
      total: subjects.length,
      subjects
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Assign Subjects to class
const assignSubjectToClass = async (req, res) => {
  try {
    const { classId, subjectId, teacherId } = req.body;

    if (!classId || !subjectId || !teacherId) {
      return res.status(400).json({
        message: "classId, subjectId and teacherId are required"
      });
    }

    const mapping = await ClassSubject.create({
      classId,
      subjectId,
      teacherId,
      createdBy: req.user.id
    });

    res.status(201).json({
      message: "Subject assigned to class successfully",
      mapping
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        message: "This subject is already assigned to this class"
      });
    }
    res.status(500).json({ message: "Server error" });
  }
};

// Get all Assigned classes
const getSubjectsByClass = async (req, res) => {
  try {
    const { classId } = req.params;

    const data = await ClassSubject.find({ classId, isActive: true })
      .populate("subjectId", "name code")
      .populate("teacherId", "name email");

    res.json({
      total: data.length,
      subjects: data
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Addign student to class
const assignStudentToClass = async (req, res) => {
  try {
    const { classId, studentId } = req.body;

    if (!classId || !studentId) {
      return res.status(400).json({
        message: "classId and studentId are required"
      });
    }

    const mapping = await ClassStudent.create({
      classId,
      studentId,
      createdBy: req.user.id
    });

    res.status(201).json({
      message: "Student assigned to class successfully",
      mapping
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        message: "Student already assigned to this class"
      });
    }
    res.status(500).json({ message: "Server error" });
  }
};

// get all assigned class of student
const getStudentsByClass = async (req, res) => {
  try {
    const { classId } = req.params;

    const students = await ClassStudent.find({
      classId,
      isActive: true
    })
      .populate("studentId", "name email gender");

    res.json({
      total: students.length,
      students
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Admin View overall attendance of particular class
const getClassAttendanceReport = async (req, res) => {
  try {
    const { classId, date } = req.query;

    const filter = { classId };
    if (date) filter.date = date;

    const records = await Attendance.find(filter)
      .populate("studentId", "name")
      .populate("subjectId", "name");

    res.json({
      totalRecords: records.length,
      records
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Admin view asssignment report
const getAssignmentPerformance = async (req, res) => {
  try {
    const { assignmentId } = req.query;

    const submissions = await AssignmentSubmission.find({ assignmentId })
      .populate("studentId", "name");

    res.json({
      totalSubmissions: submissions.length,
      submissions
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Update Class
const updateClass = async (req, res) => {
  try {
    const { id } = req.params;
    const { className, section, classTeacher } = req.body;

    const updatedClass = await Class.findByIdAndUpdate(
      id,
      { className, section, classTeacher },
      { new: true }
    );

    res.json({
      message: "Class updated successfully",
      class: updatedClass
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Update Class Status
const updateClassStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const updatedClass = await Class.findByIdAndUpdate(
      id,
      { isActive },
      { new: true }
    );

    res.json({
      message: `Class ${isActive ? "activated" : "deactivated"} successfully`
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Update Subject
const updateSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code } = req.body;

    const updatedSubject = await Subject.findByIdAndUpdate(
      id,
      { name, code },
      { new: true }
    );

    res.json({
      message: "Subject updated successfully",
      subject: updatedSubject
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Update Subject Status
const updateSubjectStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const updatedSubject = await Subject.findByIdAndUpdate(
      id,
      { isActive },
      { new: true }
    );

    res.json({
      message: `Subject ${isActive ? "activated" : "deactivated"} successfully`
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Get Available Classes for dropdown
const getAvailableClasses = async (req, res) => {
  try {
    const classes = await Class.find({ isActive: true })
      .select("className section");
    res.json({ classes });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Get Admin Profile
const getAdminProfile = async (req, res) => {
  try {
    const adminId = req.user.id;
    
    const admin = await User.findById(adminId).select("-password");
    
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }
    
    res.json({ user: admin });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Update Admin Profile
const updateAdminProfile = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { name, gender, Dob } = req.body;
    
    const admin = await User.findById(adminId);
    
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }
    
    if (name) admin.name = name;
    if (gender) admin.gender = gender;
    if (Dob) admin.Dob = Dob;
    
    await admin.save();
    
    res.json({ 
      message: "Profile updated successfully", 
      user: admin 
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Change Admin Password
const changeAdminPassword = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "All fields are required" });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ 
        message: "Password must be at least 6 characters" 
      });
    }
    
    const admin = await User.findById(adminId);
    
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }
    
    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, admin.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }
    
    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    admin.password = hashedPassword;
    await admin.save();
    
    res.json({ message: "Password changed successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Enhanced Dashboard with more stats
const getEnhancedAdminDashboard = async (req, res) => {
  try {
    // User counts
    const totalUsers = await User.countDocuments();
    const totalTeachers = await User.countDocuments({ role: "teacher" });
    const totalAdmins = await User.countDocuments({ role: "admin" });
    const totalStudents = await User.countDocuments({ role: "student" });
    const totalAccountants = await User.countDocuments({ role: "accountant" });
    
    // Class and Subject counts
    const totalClasses = await Class.countDocuments({ isActive: true });
    const totalSubjects = await Subject.countDocuments({ isActive: true });
    
    // Recent activities
    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select("name email role createdAt");
    
    // Today's statistics
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Today's attendance count
    const todayAttendance = await Attendance.countDocuments({
      date: {
        $gte: today,
        $lt: tomorrow
      }
    });
    
    // Active assignments
    const activeAssignments = await Assignment.countDocuments({ 
      isActive: true,
      dueDate: { $gte: today.toISOString().split('T')[0] }
    });
    
    // Pending homework
    const pendingHomework = await Homework.countDocuments({ 
      isActive: true,
      dueDate: { $gte: today.toISOString().split('T')[0] }
    });
    
    // Class distribution (students per class)
    const classDistribution = await ClassStudent.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: "$classId", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);
    
    // Populate class details for distribution
    await Class.populate(classDistribution, { 
      path: "_id", 
      select: "className section" 
    });
    
    res.json({ totalUsers, totalAdmins, totalTeachers, totalStudents, totalAccountants, totalClasses, totalSubjects, todayAttendance, activeAssignments, pendingHomework, recentUsers, classDistribution,
      // Additional insights
      activeUsers: await User.countDocuments({ isActive: true }),
      inactiveUsers: await User.countDocuments({ isActive: false })
    });
    
  } catch (error) {
    console.error("Dashboard Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Add to auth.js - Update Subject-Teacher Assignment
const updateSubjectAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const { teacherId } = req.body;

    if (!teacherId) {
      return res.status(400).json({
        message: "Teacher ID is required"
      });
    }

    const assignment = await ClassSubject.findById(id);
    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    // Check if teacher exists and is active
    const teacher = await User.findOne({ _id: teacherId, role: "teacher", isActive: true });
    if (!teacher) {
      return res.status(400).json({ message: "Invalid or inactive teacher" });
    }

    assignment.teacherId = teacherId;
    await assignment.save();

    res.json({
      message: "Teacher updated successfully",
      assignment
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Add to auth.js - Delete Subject Assignment (when teacher leaves)
const deleteSubjectAssignment = async (req, res) => {
  try {
    const { id } = req.params;

    const assignment = await ClassSubject.findById(id);
    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    // Soft delete by setting isActive to false
    assignment.isActive = false;
    await assignment.save();

    res.json({
      message: "Assignment removed successfully"
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Add to auth.js - Get All Teachers for Dropdown 
const getAllTeachers = async (req, res) => {
  try {
    const teachers = await User.find({ 
      role: "teacher", 
      isActive: true 
    }).select("name email subject");
    
    res.json({ teachers });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Get Single User Details
const getUserDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id)
      .populate({
        path: "createdBy",
        select: "name email"
      });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // For students, get class information
    let classInfo = null;
    if (user.role === "student") {
      const classStudent = await ClassStudent.findOne({ 
        studentId: id, 
        isActive: true 
      }).populate("classId", "className section classTeacher");
      
      if (classStudent) {
        classInfo = classStudent.classId;
      }
    }

    res.json({
      user,
      classInfo
    });
  } catch (error) {
    console.error("Error fetching user details:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Pagination
// Get Users Advanced with Pagination and Filters
const getUsersAdvanced = async (req, res) => {
  try {
    const { 
      role, 
      isActive, 
      search, 
      page = 1, 
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    let filter = {};

    // Role filter
    if (role) filter.role = role;
    
    // Status filter
    if (isActive !== undefined && isActive !== '') {
      filter.isActive = isActive === 'true';
    }

    // Search filter (name, email, employeeId, etc.)
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } },
        { admissionNo: { $regex: search, $options: 'i' } }
      ];
    }

    // Sorting
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Execute queries
    const users = await User.find(filter)
      .select("-password") // Password exclude karo
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .populate("createdBy", "name email");

    const total = await User.countDocuments(filter);

    res.json({
      users,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit))
    });

  } catch (error) {
    console.error("Error fetching users advanced:", error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { createAdmin, loginUser, createUser, getUsers, updateUserStatus, updateUserProfile, changeUserPassword, createClass, getAllClasses, createSubject, getAllSubjects, assignSubjectToClass, getSubjectsByClass, assignStudentToClass, getStudentsByClass, getClassAttendanceReport, getAssignmentPerformance, updateClass, updateClassStatus, updateSubject, updateSubjectStatus, getAvailableClasses, getAdminProfile, updateAdminProfile, changeAdminPassword,
getEnhancedAdminDashboard, updateSubjectAssignment, deleteSubjectAssignment, getAllTeachers, getUserDetails, getUsersAdvanced };
