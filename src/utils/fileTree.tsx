import React, { useState } from 'react';
import { FileNode } from '../component/GitHubConnector';
import './FileTree.css';

interface FileTreeProps {
  files: FileNode[];
  onFileSelect?: (filePath: string) => void;
  selectedFile?: string | null;
}

const FileTreeItem: React.FC<{
  file: FileNode;
  depth: number;
  onFileSelect?: (filePath: string) => void;
  selectedFile?: string | null;
}> = ({ file, depth, onFileSelect, selectedFile }) => {
  const [expanded, setExpanded] = useState(depth < 2); // Auto-expand first two levels
  
  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(!expanded);
  };
  
  const handleClick = () => {
    if (file.type === 'file' && onFileSelect) {
      onFileSelect(file.path);
    } else if (file.type === 'directory') {
      setExpanded(!expanded);
    }
  };
  
  const isSelected = selectedFile === file.path;
  
  return (
    <li className="file-tree-item">
      <div 
        className={`file-tree-node ${file.type} ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: `${depth * 16}px` }}
        onClick={handleClick}
      >
        {file.type === 'directory' && file.children && file.children.length > 0 && (
          <span 
            className={`toggle-icon ${expanded ? 'expanded' : 'collapsed'}`}
            onClick={handleToggle}
          >
            {expanded ? '▼' : '►'}
          </span>
        )}
        
        <span className="file-icon">
          {file.type === 'directory' ? '📁' : getFileIcon(file.path)}
        </span>
        
        <span className="file-name">
          {file.path.split('/').pop() || file.path}
        </span>