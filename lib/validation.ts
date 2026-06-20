import { z } from "zod";

export const transactionSchema = z
  .object({
    type: z.enum(["income", "expense", "transfer", "capital"]),
    date: z.string().min(1, "Tanggal wajib diisi"),
    categoryId: z.string().optional(),
    cashAccountId: z.string().optional(),
    sourceAccountId: z.string().optional(),
    destinationAccountId: z.string().optional(),
    amount: z.number().positive("Nominal harus lebih dari 0"),
    description: z.string().min(3, "Deskripsi minimal 3 karakter"),
    capitalType: z.enum(["setoran", "prive", "dividen"]).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.type === "transfer") {
      if (!value.sourceAccountId) {
        ctx.addIssue({
          code: "custom",
          path: ["sourceAccountId"],
          message: "Akun sumber wajib diisi",
        });
      }
      if (!value.destinationAccountId) {
        ctx.addIssue({
          code: "custom",
          path: ["destinationAccountId"],
          message: "Akun tujuan wajib diisi",
        });
      }
      if (
        value.sourceAccountId &&
        value.destinationAccountId &&
        value.sourceAccountId === value.destinationAccountId
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["destinationAccountId"],
          message: "Akun tujuan harus berbeda",
        });
      }
    } else if (value.type === "capital") {
      if (!value.cashAccountId) {
        ctx.addIssue({
          code: "custom",
          path: ["cashAccountId"],
          message: "Akun kas wajib diisi",
        });
      }
      if (!value.capitalType) {
        ctx.addIssue({
          code: "custom",
          path: ["capitalType"],
          message: "Jenis modal wajib dipilih",
        });
      }
    } else {
      if (!value.categoryId) {
        ctx.addIssue({
          code: "custom",
          path: ["categoryId"],
          message: "Kategori wajib diisi",
        });
      }
      if (!value.cashAccountId) {
        ctx.addIssue({
          code: "custom",
          path: ["cashAccountId"],
          message: "Akun kas wajib diisi",
        });
      }
    }
  });

export type TransactionFormValues = z.infer<typeof transactionSchema>;

export const businessProfileSchema = z.object({
  businessName: z.string().min(2, "Nama bisnis wajib diisi"),
  ownerName: z.string().min(2, "Nama pemilik wajib diisi"),
  businessType: z.enum([
    "retail",
    "service",
    "online_shop",
    "distributor",
    "freelancer",
  ]),
  taxNumber: z.string().optional(),
});

export type BusinessProfileFormValues = z.infer<typeof businessProfileSchema>;
