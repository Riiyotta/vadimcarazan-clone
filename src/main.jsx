import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import CaseStudy from './pages/CaseStudy.jsx'
import { loadData } from './engine/data.js'
import './index.css'

// two routes: "/" is the cosmos, "/work/<slug>" is a case-study page
const m = location.pathname.match(/^\/work\/([^/]+)\/?$/)

loadData().then((data) => {
  createRoot(document.getElementById('root')).render(m ? <CaseStudy data={data} slug={decodeURIComponent(m[1])} /> : <App data={data} />)
})
