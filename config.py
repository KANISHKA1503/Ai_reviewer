import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    """Application configuration loaded from environment variables."""

    # --- Authentication ---
    GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN")
    GITLAB_TOKEN = os.environ.get("GITLAB_TOKEN")
    GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
    WEBHOOK_SECRET = os.environ.get("WEBHOOK_SECRET")
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-key-change-in-production")

    # --- Server ---
    PORT = int(os.environ.get("PORT", 5000))
    LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO")
    DEBUG = os.environ.get("FLASK_DEBUG", "false").lower() == "true"

    # --- Database ---
    DATABASE_PATH = os.environ.get(
        "DATABASE_PATH",
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "reviews.db"),
    )

    # --- Analysis ---
    MAX_FILE_SIZE_KB = int(os.environ.get("MAX_FILE_SIZE_KB", 500))
    MAX_FILES_PER_PR = int(os.environ.get("MAX_FILES_PER_PR", 50))
    GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")

    SUPPORTED_EXTENSIONS = {
        ".py", ".js", ".ts", ".jsx", ".tsx", ".java", ".go", ".rs",
        ".rb", ".php", ".c", ".cpp", ".h", ".hpp", ".cs", ".swift",
        ".kt", ".scala", ".sql", ".sh", ".bash", ".yaml", ".yml",
        ".json", ".xml", ".html", ".css", ".scss", ".vue", ".svelte",
    }

    SKIP_PATTERNS = {
        "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
        "Pipfile.lock", "poetry.lock", "go.sum",
        ".min.js", ".min.css", ".map",
        "__pycache__", "node_modules", ".git",
    }

    # --- Language Mapping ---
    EXTENSION_TO_LANGUAGE = {
        ".py": "python", ".js": "javascript", ".ts": "typescript",
        ".jsx": "javascript", ".tsx": "typescript", ".java": "java",
        ".go": "go", ".rs": "rust", ".rb": "ruby", ".php": "php",
        ".c": "c", ".cpp": "cpp", ".h": "c", ".hpp": "cpp",
        ".cs": "csharp", ".swift": "swift", ".kt": "kotlin",
        ".scala": "scala", ".sql": "sql", ".sh": "bash",
        ".bash": "bash", ".yaml": "yaml", ".yml": "yaml",
        ".json": "json", ".xml": "xml", ".html": "html",
        ".css": "css", ".scss": "scss", ".vue": "vue",
        ".svelte": "svelte",
    }

    # --- Agent Configuration ---
    AGENT_MODE = os.environ.get("AGENT_MODE", "true").lower() == "true"
    AGENT_AUTO_FIX = os.environ.get("AGENT_AUTO_FIX", "true").lower() == "true"
    AGENT_CREATE_ISSUES = os.environ.get("AGENT_CREATE_ISSUES", "true").lower() == "true"
    AGENT_MAX_ITERATIONS = int(os.environ.get("AGENT_MAX_ITERATIONS", "3"))

