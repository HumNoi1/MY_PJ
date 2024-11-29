import React from "react";
import { Plus } from "lucide-react";
import Nav from "@/components/Nav";
import Link from "next/link";

const Dashboard = () => {
  return (
    <div className="flex">
      <Nav />
      <div className="flex-grow p-6 bg-slate-800 min-h-screen w-screen">
        <div className="grid grid-cols-12 gap-4">
          {/* Add Button */}
          <div className="col-span-3">
            <Link href="./addclass" className="w-full h-32 rounded-lg border-2 border-slate-600 flex items-center justify-center hover:bg-slate-700 transition-colors">
              <Plus className="w-8 h-8 text-slate-400" />
            </Link>
          </div>
        
          {/* Folder */}
          <div className="col-span-3">
            <div className="w-full h-32 rounded-lg bg-blue-500 p-4 flex flex-col justify-end">
              <span className="text-sm text-white">software engineer</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;