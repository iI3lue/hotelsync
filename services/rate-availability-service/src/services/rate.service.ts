import prisma from "../lib/prisma.js";

export class RateService {
  async findByRoomType(roomTypeId: string) {
    return prisma.rate.findMany({
      where: { room_type_id: roomTypeId },
      orderBy: { report_date: "asc" },
    });
  }

  async create(roomTypeId: string, reportDate: string, price: number) {
    return prisma.rate.create({
      data: {
        room_type_id: roomTypeId,
        report_date: new Date(reportDate),
        price,
      },
    });
  }
}

export const rateService = new RateService();
