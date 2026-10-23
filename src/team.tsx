import Employees from "./employees";
function App() {
  return (
    <div>
      <h1>Alle Mitarbeiter werden hier aufgelistet</h1>
      <br />
      <div className="grid grid-cols-2 w-80 gap-4">
        <Employees
          surname="Berthold"
          lastname="Martan"
          position="Betriebsleiter"
          employeeID="1"
        />

        <Employees
          surname="Alperen"
          lastname="Meseli"
          position="Software Entwickler & Datenbank Manager"
          employeeID="45"
        />
      </div>
    </div>
  );
}

export default App;
