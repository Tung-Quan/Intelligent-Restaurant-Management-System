import { describe, expect, it } from "vitest";
import {
  getHostBoardCounts,
  getReservationUrgency,
  getSuggestedTables,
  sortReservationsForHost,
} from "@/lib/reservations";

const now = new Date("2026-04-16T12:00:00.000Z");

describe("reservation helpers", () => {
  it("classifies urgency for host workflows", () => {
    expect(
      getReservationUrgency({ reservation_time: "2026-04-16T11:30:00.000Z", status: "pending" }, now)
    ).toBe("late");
    expect(
      getReservationUrgency({ reservation_time: "2026-04-16T12:10:00.000Z", status: "pending" }, now)
    ).toBe("imminent");
    expect(
      getReservationUrgency({ reservation_time: "2026-04-16T12:45:00.000Z", status: "confirmed" }, now)
    ).toBe("soon");
    expect(
      getReservationUrgency({ reservation_time: "2026-04-16T14:00:00.000Z", status: "confirmed" }, now)
    ).toBe("upcoming");
    expect(
      getReservationUrgency({ reservation_time: "2026-04-16T11:00:00.000Z", status: "completed" }, now)
    ).toBe("history");
  });

  it("sorts host reservations by urgency and time", () => {
    const sorted = sortReservationsForHost(
      [
        { id: "3", customer_name: "Cara", party_size: 2, reservation_time: "2026-04-16T14:00:00.000Z", status: "confirmed" },
        { id: "1", customer_name: "Alice", party_size: 2, reservation_time: "2026-04-16T11:35:00.000Z", status: "pending" },
        { id: "2", customer_name: "Bob", party_size: 4, reservation_time: "2026-04-16T12:05:00.000Z", status: "pending" },
      ],
      now
    );

    expect(sorted.map((reservation) => reservation.id)).toEqual(["1", "2", "3"]);
  });

  it("counts host board metrics", () => {
    const counts = getHostBoardCounts(
      [
        { id: "1", customer_name: "Alice", party_size: 2, reservation_time: "2026-04-16T11:35:00.000Z", status: "pending" },
        { id: "2", customer_name: "Bob", party_size: 4, reservation_time: "2026-04-16T12:05:00.000Z", status: "confirmed" },
        { id: "3", customer_name: "Cara", party_size: 4, reservation_time: "2026-04-16T13:30:00.000Z", status: "seated" },
      ],
      now
    );

    expect(counts).toEqual({
      arrivingSoon: 2,
      needHold: 1,
      readyToSeat: 1,
      currentlySeated: 1,
    });
  });

  it("suggests best-fit available tables", () => {
    const suggestions = getSuggestedTables(
      [
        { id: "1", table_number: 5, capacity: 6, status: "available", location_zone: "main" },
        { id: "2", table_number: 2, capacity: 4, status: "available", location_zone: "patio" },
        { id: "3", table_number: 1, capacity: 4, status: "occupied", location_zone: "main" },
      ],
      4
    );

    expect(suggestions.map((table) => table.table_number)).toEqual([2, 5]);
  });
});
