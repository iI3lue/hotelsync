import prisma from "../lib/prisma.js";
import { AppError } from "../middleware/error-handler.js";
import {
  AssignTaskInput,
  ListRoomsQuery,
  ListTasksQuery,
  SetRoomStatusInput,
} from "../validators/housekeeping.js";

const TRANSITIONS: Record<string, string[]> = {
  pending: ["assigned", "in_progress", "cancelled"],
  assigned: ["in_progress", "cancelled"],
  in_progress: ["done", "cancelled"],
  done: [],
  cancelled: [],
};

export class HousekeepingService {
  /** Cola de tareas por hotel y estado (HK-3). */
  async listTasks(query: ListTasksQuery) {
    return prisma.cleaningTask.findMany({
      where: {
        hotel_id: query.hotel_id,
        ...(query.status ? { status: query.status } : {}),
      },
      orderBy: { created_at: "asc" },
    });
  }

  /** Asigna una tarea al personal de limpieza (HK-3). */
  async assignTask(id: string, data: AssignTaskInput) {
    const task = await prisma.cleaningTask.findUnique({
      where: { task_id: id },
    });

    if (!task) {
      throw new AppError(404, `Task with id ${id} not found`, "Not Found");
    }
    if (task.status !== "pending") {
      throw new AppError(
        409,
        `Cannot assign task with status ${task.status}`,
        "Conflict"
      );
    }

    return prisma.cleaningTask.update({
      where: { task_id: id },
      data: { status: "assigned", assigned_to: data.assigned_to },
    });
  }

  /** Marca una tarea en progreso. */
  async startTask(id: string) {
    return this.transitionTask(id, "in_progress");
  }

  /**
   * Completa la tarea y deja la habitación lista en la misma
   * transacción (HK-4: ocupación y limpieza sin conflictos).
   */
  async completeTask(id: string) {
    const task = await prisma.cleaningTask.findUnique({
      where: { task_id: id },
    });

    if (!task) {
      throw new AppError(404, `Task with id ${id} not found`, "Not Found");
    }
    if (task.status === "done") return task;
    if (!TRANSITIONS[task.status]?.includes("done")) {
      throw new AppError(
        409,
        `Cannot complete task with status ${task.status}`,
        "Conflict"
      );
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.cleaningTask.update({
        where: { task_id: id },
        data: { status: "done" },
      });

      await tx.room.upsert({
        where: {
          hotel_id_room_number: {
            hotel_id: task.hotel_id,
            room_number: task.physical_room_number,
          },
        },
        create: {
          hotel_id: task.hotel_id,
          room_number: task.physical_room_number,
          status: "ready",
        },
        update: { status: "ready" },
      });

      return updated;
    });
  }

  /** Estados de habitación por hotel (HK-1). */
  async listRooms(query: ListRoomsQuery) {
    return prisma.room.findMany({
      where: { hotel_id: query.hotel_id },
      orderBy: { room_number: "asc" },
    });
  }

  /** Cambio manual de estado (ej. maintenance) (HK-1). */
  async setRoomStatus(data: SetRoomStatusInput) {
    return prisma.room.upsert({
      where: {
        hotel_id_room_number: {
          hotel_id: data.hotel_id,
          room_number: data.room_number,
        },
      },
      create: {
        hotel_id: data.hotel_id,
        room_number: data.room_number,
        status: data.status,
      },
      update: { status: data.status },
    });
  }

  private async transitionTask(id: string, to: string) {
    const task = await prisma.cleaningTask.findUnique({
      where: { task_id: id },
    });

    if (!task) {
      throw new AppError(404, `Task with id ${id} not found`, "Not Found");
    }
    if (!TRANSITIONS[task.status]?.includes(to)) {
      throw new AppError(
        409,
        `Cannot transition task from ${task.status} to ${to}`,
        "Conflict"
      );
    }

    if (to === "in_progress") {
      await prisma.room.updateMany({
        where: {
          hotel_id: task.hotel_id,
          room_number: task.physical_room_number,
        },
        data: { status: "cleaning" },
      });
    }

    return prisma.cleaningTask.update({
      where: { task_id: id },
      data: { status: to },
    });
  }
}

export const housekeepingService = new HousekeepingService();
