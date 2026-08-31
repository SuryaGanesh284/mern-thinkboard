import { useState, useEffect } from "react";
import { Link } from "react-router";
import { PlusIcon, SparklesIcon, SearchIcon, BrainIcon } from "lucide-react";
import AskBrainModal from "./AskBrainModal";

const Navbar = () => {
  const [isBrainModalOpen, setIsBrainModalOpen] = useState(false);

  // Global Ctrl + K / Cmd + K keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsBrainModalOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <header className="bg-base-300/80 backdrop-blur-md sticky top-0 z-40 border-b border-base-content/10">
        <div className="mx-auto max-w-6xl p-4">
          <div className="flex items-center justify-between gap-4">
            {/* Logo */}
            <Link to={"/"} className="flex items-center gap-2 group">
              <div className="p-2 rounded-xl bg-primary/10 text-primary group-hover:scale-105 transition-transform">
                <BrainIcon className="size-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-primary font-mono tracking-tight flex items-center gap-1.5">
                  ThinkBoard
                  <span className="badge badge-primary badge-xs font-sans font-semibold">AI</span>
                </h1>
              </div>
            </Link>

            {/* Middle: AI Search & Second Brain Command Trigger */}
            <button
              type="button"
              onClick={() => setIsBrainModalOpen(true)}
              className="flex-1 max-w-md hidden sm:flex items-center justify-between px-4 py-2 rounded-xl bg-base-100 hover:bg-base-200 border border-base-content/10 hover:border-primary/40 transition-all text-left shadow-sm group"
            >
              <div className="flex items-center gap-2.5 text-base-content/60 group-hover:text-base-content transition-colors text-sm">
                <SparklesIcon className="size-4 text-primary animate-pulse" />
                <span>Ask your second brain or search...</span>
              </div>
              <kbd className="kbd kbd-sm bg-base-300 font-mono text-xs border border-base-content/10">
                Ctrl + K
              </kbd>
            </button>

            {/* Right: Actions */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Mobile Search Button */}
              <button
                type="button"
                onClick={() => setIsBrainModalOpen(true)}
                className="btn btn-ghost btn-circle sm:hidden"
                title="Search notes"
              >
                <SearchIcon className="size-5 text-primary" />
              </button>

              <Link to={"/create"} className="btn btn-primary btn-sm sm:btn-md gap-2 shadow-md shadow-primary/20">
                <PlusIcon className="size-4 sm:size-5" />
                <span>New Note</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Ask Second Brain Modal */}
      <AskBrainModal
        isOpen={isBrainModalOpen}
        onClose={() => setIsBrainModalOpen(false)}
      />
    </>
  );
};

export default Navbar;
