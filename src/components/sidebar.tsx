import { useState } from "react";
import { Home, Image as ImageIcon, FileText, Calendar } from "lucide-react"; // Platzhalter für Icons

// Diese Props kommen idealerweise aus deinem globalen State oder Auth-Context
type SidebarProps = {
  currentUser: { name: string; role: string };
  activePage: string;
  setActivePage: (page: string) => void;
};

export default function Sidebar({
  currentUser,
  activePage,
  setActivePage,
}: SidebarProps) {
  const isBertl = currentUser.name.includes("Berthold"); // Oder über eine Role/ID prüfen

  return (
    <div className="w-64 h-screen bg-gray-900 text-white flex flex-col fixed left-0 top-0 shadow-xl">
      <div className="p-6 text-2xl font-bold border-b border-gray-800">
        Pfänderbahn
      </div>

      <nav className="flex-1 p-4 space-y-2">
        <button
          onClick={() => setActivePage("home")}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
            activePage === "home"
              ? "bg-blue-600 text-white"
              : "hover:bg-gray-800 text-gray-300"
          }`}
        >
          <Home size={20} />
          <span>Home</span>
        </button>

        {!isBertl && (
          <button
            onClick={() => setActivePage("krankenstand")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              activePage === "krankenstand"
                ? "bg-blue-600 text-white"
                : "hover:bg-gray-800 text-gray-300"
            }`}
          >
            <ImageIcon size={20} />
            <span>Krankenstand</span>
          </button>
        )}

        {isBertl && (
          <button
            onClick={() => setActivePage("krankenbescheinigungen")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              activePage === "krankenbescheinigungen"
                ? "bg-blue-600 text-white"
                : "hover:bg-gray-800 text-gray-300"
            }`}
          >
            <FileText size={20} />
            <span>Krankenbescheinigungen</span>
          </button>
        )}
      </nav>
    </div>
  );
}
