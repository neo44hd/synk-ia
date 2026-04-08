import React from 'react'
import './App.css'
import Pages from "@/pages/index.jsx"
import { Toaster } from "@/components/ui/toaster"

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error('App crash:', error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{padding:'2rem',color:'white',background:'#0a0a0b',minHeight:'100vh'}}>
          <h1 style={{color:'#ef4444'}}>Error en la aplicación</h1>
          <pre style={{color:'#fca5a5',fontSize:'0.875rem',whiteSpace:'pre-wrap'}}>{this.state.error?.message}</pre>
          <button onClick={()=>window.location.reload()} style={{marginTop:'1rem',padding:'0.5rem 1rem',background:'#06b6d4',border:'none',borderRadius:'0.5rem',color:'white',cursor:'pointer'}}>Recargar</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  return (
    <ErrorBoundary>
      <Pages />
      <Toaster />
    </ErrorBoundary>
  )
}

export default App