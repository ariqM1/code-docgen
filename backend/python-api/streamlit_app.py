import streamlit as st
import requests
import json
import time
from typing import Dict, List, Optional

# Configure Streamlit page
st.set_page_config(
    page_title="Repository Chat Assistant",
    page_icon="🤖",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Backend API configuration
API_BASE_URL = "http://localhost:4000/api"

# Initialize session state
if "messages" not in st.session_state:
    st.session_state.messages = []
if "repository" not in st.session_state:
    st.session_state.repository = None
if "documentation" not in st.session_state:
    st.session_state.documentation = None
if "conversation_history" not in st.session_state:
    st.session_state.conversation_history = []

def test_backend_connection() -> bool:
    """Test if the backend is running"""
    try:
        response = requests.get(f"{API_BASE_URL}/health", timeout=5)
        return response.status_code == 200
    except:
        return False

def connect_to_repository(repo_url: str) -> Optional[Dict]:
    """Connect to a GitHub repository"""
    try:
        response = requests.post(
            f"{API_BASE_URL}/connect-repository",
            json={"repoUrl": repo_url},
            timeout=30
        )
        if response.status_code == 200:
            return response.json()
        else:
            st.error(f"Failed to connect to repository: {response.text}")
            return None
    except Exception as e:
        st.error(f"Error connecting to repository: {str(e)}")
        return None

def generate_documentation(repository: Dict) -> Optional[Dict]:
    """Generate documentation for the repository"""
    try:
        payload = {
            "owner": repository["owner"],
            "repo": repository["name"],
            "branch": repository["defaultBranch"],
            "fileStructure": repository["fileStructure"]
        }
        
        response = requests.post(
            f"{API_BASE_URL}/generate-documentation",
            json=payload,
            timeout=300  # 5 minutes timeout for documentation generation
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            st.error(f"Failed to generate documentation: {response.text}")
            return None
    except Exception as e:
        st.error(f"Error generating documentation: {str(e)}")
        return None

def chat_with_repository(message: str, repository: Dict, documentation: Dict, conversation_history: List) -> Optional[str]:
    """Send a chat message about the repository"""
    try:
        payload = {
            "message": message,
            "repository": repository,
            "documentation": documentation["json"],
            "conversationHistory": conversation_history
        }
        
        response = requests.post(
            f"{API_BASE_URL}/chat-about-repository",
            json=payload,
            timeout=60
        )
        
        if response.status_code == 200:
            return response.json()["reply"]
        else:
            st.error(f"Chat failed: {response.text}")
            return None
    except Exception as e:
        st.error(f"Error in chat: {str(e)}")
        return None

def display_repository_info(repository: Dict):
    """Display repository information"""
    st.subheader("📁 Repository Information")
    col1, col2 = st.columns(2)
    
    with col1:
        st.write(f"**Owner:** {repository['owner']}")
        st.write(f"**Name:** {repository['name']}")
        st.write(f"**Default Branch:** {repository['defaultBranch']}")
    
    with col2:
        st.write(f"**URL:** [{repository['url']}]({repository['url']})")
        if repository.get('description'):
            st.write(f"**Description:** {repository['description']}")

def display_documentation_summary(documentation: Dict):
    """Display documentation summary"""
    if not documentation or "json" not in documentation:
        return
        
    doc_data = documentation["json"]
    summary = doc_data.get("summary", {})
    
    if summary:
        st.subheader("📊 Repository Summary")
        
        if summary.get("summary"):
            st.write(summary["summary"])
        
        col1, col2 = st.columns(2)
        
        with col1:
            if summary.get("technologies"):
                st.write("**Technologies:**")
                for tech in summary["technologies"]:
                    st.write(f"• {tech}")
        
        with col2:
            if summary.get("mainComponents"):
                st.write("**Main Components:**")
                for comp in summary["mainComponents"]:
                    st.write(f"• {comp}")

def suggest_questions(repository: Dict, documentation: Dict) -> List[str]:
    """Generate suggested questions based on the repository"""
    if not documentation or "json" not in documentation:
        return [
            "What does this repository do?",
            "How is the project structured?",
            "What are the main files?"
        ]
    
    doc_data = documentation["json"]
    suggestions = [
        "What does this repository do?",
        "How do I get started with this project?",
        "What are the main components?",
        "How is the code organized?",
    ]
    
    # Add file-specific suggestions
    files = list(doc_data.get("files", {}).keys())
    if files:
        main_files = [f for f in files if any(keyword in f.lower() for keyword in ['main', 'index', 'app', 'server'])]
        if main_files:
            suggestions.append(f"What does {main_files[0]} do?")
        if len(files) > 1:
            suggestions.append(f"Explain the {files[1]} file")
    
    return suggestions[:6]

# Main app layout
st.title("🤖 Repository Chat Assistant")
st.markdown("Ask questions about any GitHub repository after generating its documentation!")

# Sidebar for repository setup
with st.sidebar:
    st.header("🔧 Setup")
    
    # Backend connection status
    if test_backend_connection():
        st.success("✅ Backend connected")
    else:
        st.error("❌ Backend not connected")
        st.warning("Make sure the backend server is running on port 4000")
        st.stop()
    
    st.markdown("---")
    
    # Repository input
    st.subheader("Repository Setup")
    repo_url = st.text_input(
        "GitHub Repository URL",
        placeholder="https://github.com/owner/repo",
        help="Enter the full GitHub repository URL"
    )
    
    if st.button("Connect to Repository", type="primary"):
        if repo_url:
            with st.spinner("Connecting to repository..."):
                result = connect_to_repository(repo_url)
                if result and result.get("success"):
                    st.session_state.repository = result["repository"]
                    st.session_state.documentation = None  # Reset documentation
                    st.success("✅ Repository connected!")
                    st.rerun()
        else:
            st.warning("Please enter a repository URL")
    
    # Documentation generation
    if st.session_state.repository:
        st.markdown("---")
        st.subheader("Documentation")
        
        if st.session_state.documentation:
            st.success("✅ Documentation ready")
            
            # Show file count
            if "json" in st.session_state.documentation:
                file_count = len(st.session_state.documentation["json"].get("files", {}))
                st.info(f"📄 {file_count} files documented")
        else:
            if st.button("Generate Documentation", type="secondary"):
                with st.spinner("Generating documentation... This may take a few minutes."):
                    doc_result = generate_documentation(st.session_state.repository)
                    if doc_result and doc_result.get("success"):
                        st.session_state.documentation = doc_result["documentation"]
                        st.success("✅ Documentation generated!")
                        st.rerun()

# Main content area
if st.session_state.repository:
    # Display repository info
    display_repository_info(st.session_state.repository)
    
    if st.session_state.documentation:
        # Display documentation summary
        display_documentation_summary(st.session_state.documentation)
        
        st.markdown("---")
        
        # Chat interface
        st.subheader("💬 Chat with Repository")
        
        # Suggested questions
        with st.expander("💡 Suggested Questions", expanded=False):
            suggestions = suggest_questions(st.session_state.repository, st.session_state.documentation)
            cols = st.columns(2)
            for i, suggestion in enumerate(suggestions):
                with cols[i % 2]:
                    if st.button(suggestion, key=f"suggestion_{i}"):
                        # Add suggestion as user message and get response
                        user_message = {"role": "user", "content": suggestion}
                        st.session_state.messages.append(user_message)
                        st.session_state.conversation_history.append(user_message)
                        
                        with st.spinner("Getting response..."):
                            response = chat_with_repository(
                                suggestion,
                                st.session_state.repository,
                                st.session_state.documentation,
                                st.session_state.conversation_history
                            )
                            
                            if response:
                                assistant_message = {"role": "assistant", "content": response}
                                st.session_state.messages.append(assistant_message)
                                st.session_state.conversation_history.append(assistant_message)
                        
                        st.rerun()
        
        # Chat messages display
        chat_container = st.container()
        with chat_container:
            for message in st.session_state.messages:
                with st.chat_message(message["role"]):
                    st.markdown(message["content"])
        
        # Chat input
        if prompt := st.chat_input("Ask a question about this repository..."):
            # Add user message
            user_message = {"role": "user", "content": prompt}
            st.session_state.messages.append(user_message)
            st.session_state.conversation_history.append(user_message)
            
            # Display user message
            with st.chat_message("user"):
                st.markdown(prompt)
            
            # Get and display assistant response
            with st.chat_message("assistant"):
                with st.spinner("Thinking..."):
                    response = chat_with_repository(
                        prompt,
                        st.session_state.repository,
                        st.session_state.documentation,
                        st.session_state.conversation_history
                    )
                    
                    if response:
                        st.markdown(response)
                        assistant_message = {"role": "assistant", "content": response}
                        st.session_state.messages.append(assistant_message)
                        st.session_state.conversation_history.append(assistant_message)
                    else:
                        st.error("Sorry, I couldn't process your question. Please try again.")
        
        # Clear chat button
        if st.session_state.messages:
            if st.button("🗑️ Clear Chat"):
                st.session_state.messages = []
                st.session_state.conversation_history = []
                st.rerun()
    
    else:
        st.info("👆 Generate documentation first to start chatting about the repository")

else:
    # Welcome message
    st.markdown("""
    ## Welcome! 👋
    
    To get started:
    1. **Enter a GitHub repository URL** in the sidebar
    2. **Connect to the repository** to fetch its structure  
    3. **Generate documentation** using AI analysis
    4. **Start chatting** with the AI about the codebase!
    
    ### Example repositories to try:
    - `https://github.com/streamlit/streamlit`
    - `https://github.com/pallets/flask`
    - `https://github.com/django/django`
    - `https://github.com/fastapi/fastapi`
    
    The AI will analyze the code and help you understand:
    - 🎯 What the project does
    - 🏗️ How it's structured  
    - 🔍 Specific files and functions
    - 🐛 Common issues and solutions
    - 🚀 How to get started
    """)

# Footer
st.markdown("---")
st.markdown(
    "<div style='text-align: center; color: gray;'>"
    "Repository Chat Assistant • Powered by Claude AI"
    "</div>",
    unsafe_allow_html=True
)