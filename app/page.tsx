import { appDb } from "@/lib/app-db";

export const dynamic = "force-dynamic";

// Placeholder until the Queue screen (build step 2).
export default async function Home() {
  const db = await appDb();
  const counts = await db.query<{ name: string; n: number }>(`
    select u.name, count(*)::int as n from unit u
    join field_value v on v.field_id = 'f_holder' and v.value_json #>> '{}' = u.name
    group by u.name order by n desc`);
  return (
    <main>
      <h1>Relay · Larkspur Outdoor Co.</h1>
      <p>Data model, seed and permission function are in. Team screens come next.</p>
      <table>
        <thead>
          <tr><th>Unit</th><th>Initiatives held</th></tr>
        </thead>
        <tbody>
          {counts.rows.map((r) => (
            <tr key={r.name}><td>{r.name}</td><td>{r.n}</td></tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
