export default function Header() {
  return (
    <header className="bg-black text-white py-4 px-6 shadow-md flex justify-between items-center">
      <h1 className="text-2xl font-bold tracking-wide">Dead Wax Dialogues</h1>
      <nav className="space-x-4">
        <a href="/" className="hover:underline">Events</a>
        <a href="/browse" className="hover:underline">Browse</a>
        <a href="/now-playing" className="hover:underline">Now Playing</a>
        <a href="/admin" className="hover:underline">Admin</a>
      </nav>
    </header>
  );
}
