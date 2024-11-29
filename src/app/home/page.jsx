import Nav from '@/components/Nav'
import React from 'react'

function Home() {
  return (
    <div className="flex">
      <Nav />
      <div className="bg-slate-800 min-h-screen w-screen">
        <h1 className="text-white">Hello</h1>
      </div>
    </div>
  )
}

export default Home
