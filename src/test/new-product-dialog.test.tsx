import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Tables } from "@/integrations/supabase/types";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => children,
  DialogContent: ({ children }: { children: React.ReactNode }) => children,
  DialogHeader: ({ children }: { children: React.ReactNode }) => children,
  DialogTitle: ({ children }: { children: React.ReactNode }) => children,
  DialogDescription: ({ children }: { children: React.ReactNode }) => children,
  DialogFooter: ({ children }: { children: React.ReactNode }) => children,
}));

import { NewProductDialog } from "@/routes/_authenticated/admin";

const category: Tables<"categories"> = {
  id: "cafe-id",
  name: "Cafés",
  tenant_id: "tenant-1",
  sort_order: 1,
} as Tables<"categories">;

describe("Adicionar prato", () => {
  it("mostra a categoria acima do nome e associa o seletor ao label", () => {
    render(
      <NewProductDialog
        open
        onOpenChange={() => {}}
        tenantId="tenant-1"
        categories={[category]}
        nextSortOrder={2}
        onCreated={() => {}}
      />,
    );

    const categorySelect = screen.getByLabelText("Categoria");
    const nameLabel = screen.getByText("Nome do prato");
    const categoryField = categorySelect.closest(".order-1");
    expect(categoryField).not.toBeNull();
    expect(nameLabel.parentElement).toHaveClass("order-2");
    expect(nameLabel.parentElement?.parentElement).toHaveClass("flex-col", "gap-3");
    expect(nameLabel.parentElement?.parentElement).toBe(categoryField?.parentElement);
  });
});
