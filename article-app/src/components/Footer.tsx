import noesysLogo from "../Logo/Noesys_logo.png";

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="w-full px-4 md:px-8 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <img
            src={noesysLogo}
            alt="Noesys"
            className="h-7 w-26"
          />

          <div className="h-5 w-px bg-slate-300" />

          <span className="text-sm text-slate-600">
            Contiq
          </span>
        </div>

        <div className="text-xs text-slate-500">
          © {new Date().getFullYear()} Contiq. Built by Noesys Software.
        </div>
      </div>
    </footer>
  );
}