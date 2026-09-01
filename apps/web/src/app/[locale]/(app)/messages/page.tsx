import { db } from "@tua/db";
import { MessagesView } from "./messages-view";

export default async function MessagesPage() {
  const [legs, addresses, messages] = await Promise.all([
    db.flightLeg.findMany({
      where: { loadPlans: { some: { status: "FINALIZED" } } },
      include: {
        flight: { include: { aircraft: true } },
        fromStation: true,
        toStation: true,
      },
      orderBy: { stdDep: "desc" },
    }),
    db.messageAddress.findMany({ where: { active: true }, orderBy: [{ messageType: "asc" }, { label: "asc" }] }),
    db.outgoingMessage.findMany({
      include: { leg: { include: { flight: true } }, address: true, createdBy: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return (
    <MessagesView
      legs={legs.map((leg) => ({
        id: leg.id,
        flightNo: leg.flight.flightNo,
        route: `${leg.fromStation.iata}-${leg.toStation.iata}`,
        date: leg.flight.date.toISOString().slice(0, 10),
      }))}
      addresses={addresses.map((a) => ({
        id: a.id,
        messageType: a.messageType,
        label: a.label,
        sita: a.sita,
        email: a.email,
      }))}
      messages={messages.map((m) => ({
        id: m.id,
        messageType: m.messageType,
        flightNo: m.leg.flight.flightNo,
        addressLabel: m.address.label,
        status: m.status,
        attempts: m.attempts,
        lastError: m.lastError,
        createdByName: m.createdBy.name,
        createdAt: m.createdAt.toISOString(),
        body: m.body,
      }))}
    />
  );
}
