"use client";

import React, { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import Nav from "@/components/Nav";
import Link from "next/link";
import supabase from "@/lib/supabase";

const Dashboards = () => {
  const [classes, setClasses] = useState([]);

  useEffect(() => {
    const fetchClasses = async () => {
      const { data, error } = await supabase
        .from("class")
        .select("*");

      if (error) {
        console.error("Error fetching classes:", error);
      } else {
        setClasses(data);
      }
    };

    fetchClasses();
  }, []);

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

          {/* Display Classes */}
          {classes.map((classItem) => (
            <div key={classItem.id} className="col-span-3">
              <div className="w-full h-32 rounded-lg bg-blue-500 p-4 flex flex-col justify-end">
                <span className="text-sm text-white">{classItem.name}</span>
              </div>
            </div>
          ))}

        </div>
      </div>
    </div>
  );
};

export default Dashboards;