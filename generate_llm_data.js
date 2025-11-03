const fs = require("fs");
const path = require("path");

function generateProjectContextText( // Renamed for clarity, was generateGoFileContentText
  projectPath,
  outputFile = "Code Context.txt"
) {
  const excludeDirs = ["vendor", ".git", "node_modules", ".next", ".vscode"];
  // Define allowed extensions and specific files to exclude
  const allowedExtensions = [
    ".js", "tsx", "ts", ".jsx", ".css", ".html", ".local", ".json", ".sql", ".mjs", ".md",  // Added .json
  ];
  const excludedFiles = ["package-lock.json"]; // Specific files to always exclude

  const outputStream = fs.createWriteStream(outputFile, { encoding: "utf8" });

  outputStream.write("--- Folder Structure ---\n");

  // Helper function to determine if a file should be processed
  function shouldProcessFile(fileName) {
    if (excludedFiles.includes(fileName)) {
      return false;
    }
    return allowedExtensions.some((ext) => fileName.endsWith(ext));
  }

  function walkDir(dir, relativePath = ".") {
    let files;
    try {
      files = fs.readdirSync(dir, { withFileTypes: true });
    } catch (err) {
      // Handle cases where we might not have permission to read a directory
      outputStream.write(`Error reading directory ${dir}: ${err.message}\n`);
      return;
    }


    const displayPath = relativePath === "." ? "." : `${relativePath}/`;
    outputStream.write(displayPath + "\n");

    // Sort files and directories for consistent output (optional but nice)
    files.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

    for (const file of files) {
      const fullPath = path.join(dir, file.name);
      const subPath = path.join(relativePath, file.name);

      if (file.isDirectory()) {
        // Check if any part of the path matches an excluded directory name
        // This is more robust than fullPath.includes(exclude) for nested excludes
        const pathSegments = subPath.split(path.sep);
        if (excludeDirs.some((exclude) => pathSegments.includes(exclude))) {
          continue;
        }
        walkDir(fullPath, subPath);
      } else if (file.isFile() && shouldProcessFile(file.name)) {
        outputStream.write(`  ${file.name}\n`);
      }
    }
  }

  function writeIncludedFileContents(dir, relativePath = ".") { // Added relativePath for better excludeDirs check
    let files;
     try {
      files = fs.readdirSync(dir, { withFileTypes: true });
    } catch (err) {
      outputStream.write(`Error reading directory ${dir} for content: ${err.message}\n`);
      return;
    }

    // Sort for consistency
    files.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });


    for (const file of files) {
      const fullPath = path.join(dir, file.name);
      const currentSubPath = path.join(relativePath, file.name); // Track subpath for exclusion

      if (file.isDirectory()) {
        const pathSegments = currentSubPath.split(path.sep);
        if (excludeDirs.some((exclude) => pathSegments.includes(exclude))) {
          continue;
        }
        writeIncludedFileContents(fullPath, currentSubPath); // Pass subPath
      } else if (file.isFile() && shouldProcessFile(file.name)) {
        outputStream.write(`--- ${path.join(relativePath, file.name)} ---\n`); // Use relative path for file header
        try {
          const content = fs.readFileSync(fullPath, "utf8");
          outputStream.write(content + "\n\n");
        } catch (err) {
          outputStream.write(`Error reading file ${fullPath}: ${err.message}\n\n`);
        }
      }
    }
  }

  walkDir(projectPath);
  outputStream.write("\n");
  writeIncludedFileContents(projectPath); // Start with "." as relativePath
  outputStream.end(() => {
    console.log(`Project context generated in '${outputFile}'`);
  });
}

// Replace with your actual project path if needed
// For testing, ensure you have some .json files and a package-lock.json
// in the directory or subdirectories.
const projectPath = "./";
generateProjectContextText(projectPath, "ProjectContext.txt"); // Changed output file name