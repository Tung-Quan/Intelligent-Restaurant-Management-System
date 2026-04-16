export interface ReservationLike {
  id: string;
  customer_name: string;
  party_size: number;
  reservation_time: string;
  status: string;
}

export interface TableLike {
  id: string;
  table_number: number;
  capacity: number;
  status: string;
  location_zone: string | null;
}

export type ReservationUrgency = "late" | "imminent" | "soon" | "upcoming" | "history";

export function getMinutesUntilReservation(reservationTime: string, now: Date = new Date()) {
  return Math.round((new Date(reservationTime).getTime() - now.getTime()) / 60000);
}

export function getReservationUrgency(
  reservation: Pick<ReservationLike, "reservation_time" | "status">,
  now: Date = new Date()
): ReservationUrgency {
  if (["completed", "cancelled", "no_show"].includes(reservation.status)) {
    return "history";
  }

  const minutesUntil = getMinutesUntilReservation(reservation.reservation_time, now);

  if (minutesUntil < -15) return "late";
  if (minutesUntil <= 15) return "imminent";
  if (minutesUntil <= 60) return "soon";
  return "upcoming";
}

export function getSuggestedTables(tables: TableLike[], partySize: number) {
  return tables
    .filter((table) => table.status === "available" && table.capacity >= partySize)
    .sort((left, right) => {
      const capacityDiff = left.capacity - right.capacity;
      if (capacityDiff !== 0) return capacityDiff;
      return left.table_number - right.table_number;
    });
}

export function getHostBoardCounts(reservations: ReservationLike[], now: Date = new Date()) {
  return reservations.reduce(
    (counts, reservation) => {
      const urgency = getReservationUrgency(reservation, now);

      if (urgency === "imminent" || urgency === "late") {
        counts.arrivingSoon += 1;
      }

      if (reservation.status === "pending") {
        counts.needHold += 1;
      }

      if (reservation.status === "confirmed") {
        counts.readyToSeat += 1;
      }

      if (reservation.status === "seated") {
        counts.currentlySeated += 1;
      }

      return counts;
    },
    {
      arrivingSoon: 0,
      needHold: 0,
      readyToSeat: 0,
      currentlySeated: 0,
    }
  );
}

export function sortReservationsForHost<T extends ReservationLike>(reservations: T[], now: Date = new Date()) {
  const rank: Record<ReservationUrgency, number> = {
    late: 0,
    imminent: 1,
    soon: 2,
    upcoming: 3,
    history: 4,
  };

  return reservations.slice().sort((left, right) => {
    const leftUrgency = getReservationUrgency(left, now);
    const rightUrgency = getReservationUrgency(right, now);
    const urgencyDiff = rank[leftUrgency] - rank[rightUrgency];
    if (urgencyDiff !== 0) return urgencyDiff;

    const leftTime = new Date(left.reservation_time).getTime();
    const rightTime = new Date(right.reservation_time).getTime();
    if (leftTime !== rightTime) return leftTime - rightTime;

    return left.customer_name.localeCompare(right.customer_name);
  });
}
