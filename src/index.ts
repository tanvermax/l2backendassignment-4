import express, { Request, Response } from "express";
import mongoose from "mongoose";
import QueryBuilder from "./QueryBuilder";
import cors from "cors"

const app = express();

// Connect to MongoDBmongodb://localhost:27017/
mongoose.connect("mongodb+srv://todoapp:todoapp@cluster0.toqnk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0");


app.get("/", (req: any, res: any) => {
  res.send("hello ")
})


// Task Schema
const bookSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  author: { type: String, required: true },
  genre: { type: String },
  isbn: { type: String },
  copies: { type: Number },
  available: { type: Boolean, default: true }
});

const borrowSchema = new mongoose.Schema({
  bookid: { type: mongoose.Schema.Types.ObjectId, ref: 'Book' },
  borrowNumber: { type: Number },

})

const Book = mongoose.model("Book", bookSchema);
const Borrow = mongoose.model("Borrow", borrowSchema);

app.use(express.json());
app.use(cors({
  origin: ["https://assignment-frontend-4-g11q.vercel.app",
    "https://library-frontend-lemon-nu.vercel.app"],
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));



// borrow
app.post("/api/borrow", async (req: Request, res: Response) => {
  const { bookid, borrowNumber } = req.body;
  console.log(bookid, borrowNumber)

  if (typeof borrowNumber !== "number" || isNaN(borrowNumber) || borrowNumber <= 0) {
    return res.status(400).json({ message: "Invalid borrow number" });
  }

  // Check if book exists
  const book = await Book.findById(bookid);
  if (!book) {
    return res.status(404).json({ message: "Book not found" });
  }


  if (typeof book.copies !== "number" || book.copies <= 0) {
    return res.status(400).json({ message: "No copies available" });
  }

  const borrow = new Borrow({ bookid, borrowNumber });
  const savedBorrow = await borrow.save();


  book.copies -= borrowNumber;
  book.available = book.copies > 0;

  await book.save();
  res.status(201).json(
    {

      message: "Book borrowed successfully",
      borrow: savedBorrow,
      updatedCopies: book.copies,

    }
  );
});

// gett the borrow list
app.get("/api/borrow", async (req: Request, res: Response) => {
  try {
    const result = await Borrow.aggregate([
      {
        $lookup: {
          from: 'books',
          localField: 'bookid',
          foreignField: '_id',
          as: 'bookInfo'
        }
      },
      {
        $unwind: {
          path: '$bookInfo',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          _id: 1,
          borrowNumber: 1,
          bookInfo: {
            $ifNull: [
              '$bookInfo',
              { title: "Book not found", description: "The associated book was not found" }
            ]
          }
        }
      }
    ]);

    res.json({
      message: result.length > 0
        ? "Borrow records retrieved successfully"
        : "No borrow records found",
      data: result
    });
  } catch (error) {
    console.error("Error in /api/borrow:", error);
    res.status(500).json({
      message: "Error retrieving borrow data",
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});


app.get("/api/books/:id", async (req: Request, res: Response) => {
  try {
    const book = await Book.findById(req.params.id);

    if (!book) {
      return res.status(404).json({
        success: false,
        message: "Book not found"
      });
    }

    res.json({
      success: true,
      data: book
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error retrieving book",
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get all books

app.get("/api/books", async (req: Request, res: Response) => {
  try {
    const queryBuilder = new QueryBuilder<typeof Book>(Book.find(), req.query);
    // Add query builder methods to the query
    queryBuilder
      .search(["title"]) // You can add more searchable fields
      .filter()
      .sort()
      .paginate()
      .fields();

    // Execute the query
    const books = await queryBuilder.modelQuery;

    // Count total documents and calculate pagination info
    const pagination = await queryBuilder.countTotal();

    res.json({
      books,
      pagination,
    });
  } catch (error) {
    res.status(500).json({ message: "Error retrieving tasks", error });
  }
});

// Create new task
app.post("/api/books", async (req: Request, res: Response) => {
  const book = new Book(req.body);
  const savedTask = await book.save();
  res.status(201).json(savedTask);
});



// Update task by ID
app.patch("/api/books/:id", async (req: Request, res: Response) => {
  try {
    const updatedBook = await Book.findByIdAndUpdate(
      req.params.id, // ✅ use 'id' instead of '_id'
      req.body,
      { new: true }
    );

    if (!updatedBook) {
      return res.status(404).json({ message: "Book not found" });
    }

    res.json(updatedBook);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});


// Delete task by ID
app.delete("/api/books/:id", async (req: Request, res: Response) => {
  await Book.findByIdAndDelete(req.params.id);
  res.json({ message: "Book deleted" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
