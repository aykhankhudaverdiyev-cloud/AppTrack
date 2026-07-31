/**
 * ============================================================================
 * main.jsx — Application Entry Point
 * ============================================================================
 *
 * PURPOSE:
 *   The starting point of the application. Renders the React root
 *   and wraps the application with necessary global providers.
 *
 * GLOBAL WRAPPERS:
 *   - BrowserRouter: Enables React Router functionality for the entire app.
 *   - AuthProvider:   Provides authentication state and user profile data 
 *                     to all components in the tree.
 * ============================================================================
 */

import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { AuthProvider } from './context/AuthContext'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)