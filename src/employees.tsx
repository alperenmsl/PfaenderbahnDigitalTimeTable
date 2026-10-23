type Props = {
  surname: string;
  lastname: string;
  position: string;
  employeeID: string;
};

export default function Employees({ surname, lastname, position }: Props) {
  return (
    <div className="border p4">
      <h1 className="font bold">{surname}</h1>
      <h1 className="font bold">{lastname}</h1>
      <p>{position}</p>
    </div>
  );
}
