# Backend Services

This directory contains the backend services for the code documentation generator.

## Structure

```
backend/
├── node-api/          # Express.js API server
│   ├── server.js      # Main server entry point
│   ├── services/      # Service modules
│   └── package.json   # Node.js dependencies
├── python-api/        # Streamlit chat interface
│   ├── streamlit_app.py
│   └── requirements.txt
├── tests/             # Test files
├── config/            # Configuration files (.env)
└── README.md          # This file
```

## Services

- **Node.js API** - Main REST API server for documentation generation
- **Python API** - Streamlit-based chat interface
- **Tests** - Testing utilities and scripts
- **Config** - Environment variables and configuration files