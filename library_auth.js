const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { 
  User, Book, BookIssue, LibrarySettings, LibraryHistory,
  ClassStudent 
} = require("./models");
const mongoose = require("mongoose");

/* LIBRARIAN PROFILE MANAGEMENT  */

// Get Librarian Profile
const getLibrarianProfile = async (req, res) => {
  try {
    const librarianId = req.user.id;
    
    const librarian = await User.findById(librarianId).select("-password");
    
    if (!librarian) {
      return res.status(404).json({ message: "Librarian not found" });
    }
    
    res.json({ user: librarian });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Update Librarian Profile
const updateLibrarianProfile = async (req, res) => {
  try {
    const librarianId = req.user.id;
    const { name, gender, Dob, employeeId, qualification } = req.body;
    
    const librarian = await User.findById(librarianId);
    
    if (!librarian) {
      return res.status(404).json({ message: "Librarian not found" });
    }
    
    if (name) librarian.name = name;
    if (gender) librarian.gender = gender;
    if (Dob) librarian.Dob = Dob;
    if (employeeId) librarian.employeeId = employeeId;
    if (qualification) librarian.qualification = qualification;
    
    await librarian.save();
    
    res.json({ 
      message: "Profile updated successfully", 
      user: librarian 
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Change Librarian Password
const changeLibrarianPassword = async (req, res) => {
  try {
    const librarianId = req.user.id;
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "All fields are required" });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ 
        message: "Password must be at least 6 characters" 
      });
    }
    
    const librarian = await User.findById(librarianId);
    
    if (!librarian) {
      return res.status(404).json({ message: "Librarian not found" });
    }
    
    const isMatch = await bcrypt.compare(currentPassword, librarian.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }
    
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    librarian.password = hashedPassword;
    await librarian.save();
    
    res.json({ message: "Password changed successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

/* BOOK MANAGEMENT */

// Get all books (with filters)
const getBooks = async (req, res) => {
  try {
    const { search, category, isActive, page = 1, limit = 20 } = req.query;

    let filter = { isActive: isActive !== 'false' };
    
    if (category) {
      filter.category = category;
    }
    
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { author: { $regex: search, $options: 'i' } },
        { isbn: { $regex: search, $options: 'i' } }
      ];
    }

    const books = await Book.find(filter)
      .populate("createdBy", "name")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Book.countDocuments(filter);

    res.json({
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      books
    });
  } catch (error) {
    console.error("Error fetching books:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get single book details
const getBookDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const book = await Book.findById(id)
      .populate("createdBy", "name");

    if (!book) {
      return res.status(404).json({ message: "Book not found" });
    }

    // Get current issues for this book
    const currentIssues = await BookIssue.find({
      bookId: id,
      status: "issued"
    }).populate("studentId", "name rollNo");

    res.json({
      book,
      currentIssues
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Create new book
const createBook = async (req, res) => {
  try {
    const {
      title, author, isbn, publisher, publicationYear,
      category, quantity, shelfLocation, description
    } = req.body;

    if (!title || !author || !isbn) {
      return res.status(400).json({ message: "Title, author and ISBN are required" });
    }

    // Check if book with same ISBN exists
    const existingBook = await Book.findOne({ isbn });
    if (existingBook) {
      return res.status(400).json({ message: "Book with this ISBN already exists" });
    }

    const book = await Book.create({
      title,
      author,
      isbn,
      publisher,
      publicationYear,
      category: category || "Other",
      quantity: quantity || 1,
      availableQuantity: quantity || 1,
      shelfLocation,
      description,
      createdBy: req.user.id
    });

    res.status(201).json({
      message: "Book created successfully",
      book
    });
  } catch (error) {
    console.error("Error creating book:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Update book
const updateBook = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title, author, publisher, publicationYear,
      category, quantity, shelfLocation, description, isActive
    } = req.body;

    const book = await Book.findById(id);
    if (!book) {
      return res.status(404).json({ message: "Book not found" });
    }

    if (title) book.title = title;
    if (author) book.author = author;
    if (publisher) book.publisher = publisher;
    if (publicationYear) book.publicationYear = publicationYear;
    if (category) book.category = category;
    if (shelfLocation) book.shelfLocation = shelfLocation;
    if (description !== undefined) book.description = description;
    if (isActive !== undefined) book.isActive = isActive;

    // If quantity is updated, adjust available quantity
    if (quantity !== undefined) {
      const diff = quantity - book.quantity;
      book.quantity = quantity;
      book.availableQuantity += diff;
      if (book.availableQuantity < 0) book.availableQuantity = 0;
    }

    await book.save();

    res.json({
      message: "Book updated successfully",
      book
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Delete book (soft delete)
const deleteBook = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if book is currently issued
    const activeIssues = await BookIssue.countDocuments({
      bookId: id,
      status: "issued"
    });

    if (activeIssues > 0) {
      return res.status(400).json({
        message: "Cannot delete book. It is currently issued to students."
      });
    }

    const book = await Book.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );

    if (!book) {
      return res.status(404).json({ message: "Book not found" });
    }

    res.json({ message: "Book deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

/* BOOK ISSUE MANAGEMENT  */

// Issue book to student
const issueBook = async (req, res) => {
  try {
    const librarianId = req.user.id;
    const { studentId, bookId, dueDate } = req.body;

    if (!studentId || !bookId) {
      return res.status(400).json({ message: "Student ID and Book ID are required" });
    }

    // Check if student exists and is active
    const student = await User.findOne({ _id: studentId, role: "student", isActive: true });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Check if book exists and is available
    const book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).json({ message: "Book not found" });
    }

    if (book.availableQuantity <= 0) {
      return res.status(400).json({ message: "Book is not available" });
    }

    // Check if student already has this book issued
    const existingIssue = await BookIssue.findOne({
      bookId,
      studentId,
      status: "issued"
    });

    if (existingIssue) {
      return res.status(400).json({
        message: "Student already has this book issued"
      });
    }

    // Get library settings
    const settings = await LibrarySettings.findOne() || {
      loanPeriodDays: 14,
      maxBooksPerStudent: 3
    };

    // Check if student has reached max books limit
    const studentIssues = await BookIssue.countDocuments({
      studentId,
      status: "issued"
    });

    if (studentIssues >= settings.maxBooksPerStudent) {
      return res.status(400).json({
        message: `Student cannot issue more than ${settings.maxBooksPerStudent} books`
      });
    }

    // Calculate due date
    const issueDate = new Date();
    const calculatedDueDate = dueDate || new Date(
      issueDate.getTime() + (settings.loanPeriodDays * 24 * 60 * 60 * 1000)
    );

    // Create book issue
    const bookIssue = await BookIssue.create({
      bookId,
      studentId,
      issuedBy: librarianId,
      issueDate,
      dueDate: calculatedDueDate,
      status: "issued"
    });

    // Update book availability
    book.availableQuantity -= 1;
    await book.save();

    // Create history entry
    await LibraryHistory.create({
      bookId,
      studentId,
      librarianId,
      action: "issued",
      issueDate,
      dueDate: calculatedDueDate
    });

    // Populate data for response
    await bookIssue.populate("bookId", "title author isbn");
    await bookIssue.populate("studentId", "name rollNo");

    res.status(201).json({
      message: "Book issued successfully",
      bookIssue
    });
  } catch (error) {
    console.error("Error issuing book:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Return book
const returnBook = async (req, res) => {
  try {
    const librarianId = req.user.id;
    const { issueId } = req.params;

    const bookIssue = await BookIssue.findById(issueId);
    if (!bookIssue) {
      return res.status(404).json({ message: "Book issue record not found" });
    }

    if (bookIssue.status === "returned") {
      return res.status(400).json({ message: "Book already returned" });
    }

    const returnDate = new Date();
    const dueDate = new Date(bookIssue.dueDate);
    
    // Calculate fine if returned after due date
    let fineAmount = 0;
    if (returnDate > dueDate) {
      const settings = await LibrarySettings.findOne() || { finePerDay: 5 };
      const daysLate = Math.ceil((returnDate - dueDate) / (1000 * 60 * 60 * 24));
      fineAmount = daysLate * settings.finePerDay;
    }

    // Update book issue
    bookIssue.status = "returned";
    bookIssue.returnDate = returnDate;
    bookIssue.fineAmount = fineAmount;
    await bookIssue.save();

    // Update book availability
    const book = await Book.findById(bookIssue.bookId);
    if (book) {
      book.availableQuantity += 1;
      await book.save();
    }

    // Create history entry
    await LibraryHistory.create({
      bookId: bookIssue.bookId,
      studentId: bookIssue.studentId,
      librarianId,
      action: "returned",
      issueDate: bookIssue.issueDate,
      dueDate: bookIssue.dueDate,
      returnDate,
      fineAmount
    });

    res.json({
      message: "Book returned successfully",
      fineAmount
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Get all issued books (with filters)
const getIssuedBooks = async (req, res) => {
  try {
    const { status, studentId, bookId, page = 1, limit = 20 } = req.query;

    let filter = {};
    if (status) filter.status = status;
    if (studentId) filter.studentId = studentId;
    if (bookId) filter.bookId = bookId;

    const issues = await BookIssue.find(filter)
      .populate("bookId", "title author isbn")
      .populate("studentId", "name rollNo class")
      .populate("issuedBy", "name")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await BookIssue.countDocuments(filter);

    res.json({
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      issues
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Get student's book history
const getStudentBookHistory = async (req, res) => {
  try {
    const { studentId } = req.params;

    const issues = await BookIssue.find({ studentId })
      .populate("bookId", "title author isbn")
      .populate("issuedBy", "name")
      .sort({ createdAt: -1 });

    const stats = {
      totalIssued: issues.length,
      currentlyIssued: issues.filter(i => i.status === "issued").length,
      returned: issues.filter(i => i.status === "returned").length,
      overdue: issues.filter(i => 
        i.status === "issued" && new Date(i.dueDate) < new Date()
      ).length,
      totalFine: issues.reduce((sum, i) => sum + (i.fineAmount || 0), 0)
    };

    res.json({
      stats,
      issues
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

/*  LIBRARY SETTINGS  */

// Get library settings
const getLibrarySettings = async (req, res) => {
  try {
    let settings = await LibrarySettings.findOne();
    
    if (!settings) {
      // Create default settings if not exists
      settings = await LibrarySettings.create({
        maxBooksPerStudent: 3,
        loanPeriodDays: 14,
        finePerDay: 5,
        allowRenewals: true,
        maxRenewals: 2,
        createdBy: req.user.id
      });
    }

    res.json({ settings });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Update library settings
const updateLibrarySettings = async (req, res) => {
  try {
    const {
      maxBooksPerStudent,
      loanPeriodDays,
      finePerDay,
      allowRenewals,
      maxRenewals
    } = req.body;

    let settings = await LibrarySettings.findOne();
    
    if (!settings) {
      settings = new LibrarySettings({ createdBy: req.user.id });
    }

    if (maxBooksPerStudent) settings.maxBooksPerStudent = maxBooksPerStudent;
    if (loanPeriodDays) settings.loanPeriodDays = loanPeriodDays;
    if (finePerDay) settings.finePerDay = finePerDay;
    if (allowRenewals !== undefined) settings.allowRenewals = allowRenewals;
    if (maxRenewals) settings.maxRenewals = maxRenewals;

    await settings.save();

    res.json({
      message: "Library settings updated successfully",
      settings
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

/* LIBRARY STATISTICS */

// Get library dashboard statistics
const getLibraryStatistics = async (req, res) => {
  try {
    const totalBooks = await Book.countDocuments({ isActive: true });
    const totalAvailable = await Book.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: null, total: { $sum: "$availableQuantity" } } }
    ]);

    const issuedBooks = await BookIssue.countDocuments({ status: "issued" });
    const overdueBooks = await BookIssue.countDocuments({
      status: "issued",
      dueDate: { $lt: new Date() }
    });

    const booksByCategory = await Book.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    const recentActivities = await LibraryHistory.find()
      .populate("bookId", "title")
      .populate("studentId", "name")
      .populate("librarianId", "name")
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      stats: {
        totalBooks,
        totalAvailable: totalAvailable[0]?.total || 0,
        issuedBooks,
        overdueBooks,
        availableBooks: (totalAvailable[0]?.total || 0) - issuedBooks
      },
      booksByCategory,
      recentActivities
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Get all students (for dropdown)
const getStudents = async (req, res) => {
  try {
    const { search } = req.query;

    let filter = { role: "student", isActive: true };
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { rollNo: { $regex: search, $options: 'i' } }
      ];
    }

    const students = await User.find(filter)
      .select("name email rollNo className section")
      .limit(50);

    res.json({ students });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { getLibrarianProfile, updateLibrarianProfile,
  changeLibrarianPassword, getBooks, getBookDetails, createBook, updateBook, deleteBook, issueBook,
  returnBook, getIssuedBooks, getStudentBookHistory, getLibrarySettings, updateLibrarySettings, getLibraryStatistics, getStudents
};