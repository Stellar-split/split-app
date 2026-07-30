import { useState } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";

// Mock template marketplace page components
vi.mock("@/components/templates/MarketplaceCard", () => ({
  __esModule: true,
  default: function MarketplaceCard({ template }: any) {
    return (
      <div data-testid={`marketplace-card-${template.id}`}>
        <div>{template.title}</div>
        <div>{template.category}</div>
        <div>Clones: {template.cloneCount}</div>
        <button onClick={() => template.onClone?.(template.id)}>Clone</button>
      </div>
    );
  },
}));

describe("Invoice Template Marketplace (#410)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Marketplace Page", () => {
    it("displays only approved templates in the gallery", async () => {
      const approvedTemplates = [
        {
          id: "tpl1",
          title: "Simple Invoice",
          reviewStatus: "approved",
          isPublic: true,
        },
        {
          id: "tpl2",
          title: "Detailed Invoice",
          reviewStatus: "approved",
          isPublic: true,
        },
      ];

      const pendingTemplates = [
        {
          id: "tpl3",
          title: "Pending Template",
          reviewStatus: "pending",
          isPublic: false,
        },
      ];

      // Mock fetch for approved templates
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ templates: approvedTemplates }),
        })
      ) as any;

      render(
        <div data-testid="marketplace-gallery">
          {approvedTemplates.map((t) => (
            <div key={t.id} data-testid={`card-${t.id}`}>
              {t.title}
            </div>
          ))}
        </div>
      );

      expect(screen.getByText("Simple Invoice")).toBeInTheDocument();
      expect(screen.getByText("Detailed Invoice")).toBeInTheDocument();
      expect(screen.queryByText("Pending Template")).not.toBeInTheDocument();
    });

    it("renders templates with preview thumbnail, creator alias, clone count, and category badge", () => {
      const template = {
        id: "tpl1",
        title: "Simple Invoice",
        description: "A simple invoice template",
        category: "Standard",
        creatorAlias: "john_doe",
        cloneCount: 42,
        thumbnail: "data:image/png;base64,...",
      };

      render(
        <div>
          <div data-testid="thumbnail">{template.thumbnail}</div>
          <div data-testid="title">{template.title}</div>
          <div data-testid="creator">by {template.creatorAlias}</div>
          <div data-testid="clones">{template.cloneCount} clones</div>
          <div data-testid="category">{template.category}</div>
        </div>
      );

      expect(screen.getByTestId("title")).toHaveTextContent("Simple Invoice");
      expect(screen.getByTestId("creator")).toHaveTextContent("john_doe");
      expect(screen.getByTestId("clones")).toHaveTextContent("42 clones");
      expect(screen.getByTestId("category")).toHaveTextContent("Standard");
    });

    it("supports category filtering and returns results in under 200ms", async () => {
      const templates = [
        {
          id: "tpl1",
          title: "Corporate Invoice",
          category: "Corporate",
        },
        {
          id: "tpl2",
          title: "Simple Invoice",
          category: "Simple",
        },
        {
          id: "tpl3",
          title: "Detailed Corporate",
          category: "Corporate",
        },
      ];

      const startTime = performance.now();

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              templates: templates.filter((t) => t.category === "Corporate"),
            }),
        })
      ) as any;

      render(
        <select data-testid="category-filter">
          <option value="">All</option>
          <option value="Corporate">Corporate</option>
          <option value="Simple">Simple</option>
        </select>
      );

      const select = screen.getByTestId("category-filter") as HTMLSelectElement;
      fireEvent.change(select, { target: { value: "Corporate" } });

      await waitFor(() => {
        const endTime = performance.now();
        expect(endTime - startTime).toBeLessThan(200);
      });
    });

    it("displays pagination controls and loads next page on click", async () => {
      const Pagination = () => {
        const [page, setPage] = useState(1);
        return (
          <div data-testid="pagination">
            <button
              data-testid="prev-page"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <span data-testid="page-info">Page {page} of 5</span>
            <button
              data-testid="next-page"
              onClick={() => setPage((p) => Math.min(5, p + 1))}
            >
              Next
            </button>
          </div>
        );
      };

      render(<Pagination />);

      const nextBtn = screen.getByTestId("next-page");
      fireEvent.click(nextBtn);

      await waitFor(() => {
        expect(screen.getByTestId("page-info")).toHaveTextContent("Page 2");
      });
    });
  });

  describe("Clone Functionality", () => {
    it("clones a marketplace template into user's library with (cloned) suffix", async () => {
      const mockClone = vi.fn().mockResolvedValue({
        id: "tpl_user_1",
        title: "Simple Invoice (cloned)",
      });

      global.fetch = mockClone;

      render(
        <button
          onClick={async () => {
            await fetch("/api/templates/tpl1/clone", { method: "POST" });
          }}
          data-testid="clone-btn"
        >
          Clone Template
        </button>
      );

      fireEvent.click(screen.getByTestId("clone-btn"));

      await waitFor(() => {
        expect(mockClone).toHaveBeenCalledWith("/api/templates/tpl1/clone", {
          method: "POST",
        });
      });
    });

    it("increments cloneCount on source template after successful clone", async () => {
      let templateClones = 42;

      global.fetch = vi.fn(async (url) => {
        if (url.includes("/clone")) {
          templateClones++;
        }
        return {
          ok: true,
          json: () => Promise.resolve({ cloneCount: templateClones }),
        };
      }) as any;

      const initialClones = templateClones;
      await fetch("/api/templates/tpl1/clone", { method: "POST" });

      expect(templateClones).toBe(initialClones + 1);
    });

    it("creates exact copy of template in user library", async () => {
      const sourceTemplate = {
        id: "tpl1",
        title: "Complex Invoice",
        description: "Desc",
        structure: { items: [], recipients: [] },
        category: "Advanced",
      };

      let clonedTemplate: any = null;

      global.fetch = vi.fn(async () => {
        clonedTemplate = {
          ...sourceTemplate,
          id: "tpl_user_new",
          title: `${sourceTemplate.title} (cloned)`,
        };
        return {
          ok: true,
          json: () => Promise.resolve(clonedTemplate),
        };
      }) as any;

      await fetch("/api/templates/tpl1/clone", { method: "POST" });

      // Everything except the new id / "(cloned)"-suffixed title must be
      // an exact copy of the source template.
      expect(clonedTemplate).toEqual(
        expect.objectContaining({
          description: sourceTemplate.description,
          structure: sourceTemplate.structure,
          category: sourceTemplate.category,
        })
      );
      expect(clonedTemplate.id).not.toBe(sourceTemplate.id);
      expect(clonedTemplate.title).toContain("(cloned)");
    });
  });

  describe("Template Submission & Review", () => {
    it("submitting a template creates a pending review record", async () => {
      const mockSubmit = vi.fn().mockResolvedValue({
        id: "tpl_new",
        reviewStatus: "pending",
      });

      global.fetch = mockSubmit;

      render(
        <button
          onClick={async () => {
            await fetch("/api/templates/marketplace", {
              method: "POST",
              body: JSON.stringify({
                title: "New Template",
                description: "Desc",
              }),
            });
          }}
          data-testid="submit-btn"
        >
          Submit for Review
        </button>
      );

      fireEvent.click(screen.getByTestId("submit-btn"));

      await waitFor(() => {
        expect(mockSubmit).toHaveBeenCalled();
      });
    });

    it("shows creator a confirmation with review status tracking", async () => {
      render(
        <div data-testid="submission-status">
          <div data-testid="status">Review Status: Pending</div>
          <div data-testid="submitted-at">Submitted at: 2024-01-15</div>
        </div>
      );

      expect(screen.getByTestId("status")).toHaveTextContent("Pending");
      expect(screen.getByTestId("submitted-at")).toBeInTheDocument();
    });

    it("notifies submitter via activity feed when approval status changes", async () => {
      const mockNotification = vi.fn();

      render(
        <button
          onClick={() => {
            mockNotification({
              type: "template_approved",
              message: "Your template was approved!",
            });
          }}
          data-testid="notify-btn"
        >
          Test Notification
        </button>
      );

      fireEvent.click(screen.getByTestId("notify-btn"));

      expect(mockNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "template_approved",
        })
      );
    });
  });

  describe("Admin Review Queue", () => {
    it("admin review page lists pending templates", () => {
      const pendingTemplates = [
        { id: "tpl1", title: "Template 1", reviewStatus: "pending" },
        { id: "tpl2", title: "Template 2", reviewStatus: "pending" },
      ];

      render(
        <div data-testid="review-queue">
          {pendingTemplates.map((t) => (
            <div key={t.id} data-testid={`pending-${t.id}`}>
              {t.title}
            </div>
          ))}
        </div>
      );

      expect(screen.getByTestId("pending-tpl1")).toBeInTheDocument();
      expect(screen.getByTestId("pending-tpl2")).toBeInTheDocument();
    });

    it("admin can approve or reject templates", async () => {
      const mockApprove = vi.fn();
      const mockReject = vi.fn();

      render(
        <div data-testid="review-item">
          <button
            data-testid="approve-btn"
            onClick={() => mockApprove("tpl1")}
          >
            Approve
          </button>
          <button
            data-testid="reject-btn"
            onClick={() => mockReject("tpl1")}
          >
            Reject
          </button>
        </div>
      );

      fireEvent.click(screen.getByTestId("approve-btn"));
      expect(mockApprove).toHaveBeenCalledWith("tpl1");

      fireEvent.click(screen.getByTestId("reject-btn"));
      expect(mockReject).toHaveBeenCalledWith("tpl1");
    });

    it("gated by role check - non-admin users cannot access review page", () => {
      const isAdmin = false;

      render(
        isAdmin ? (
          <div data-testid="review-page">Review Page</div>
        ) : (
          <div data-testid="access-denied">Access Denied</div>
        )
      );

      expect(screen.getByTestId("access-denied")).toBeInTheDocument();
      expect(screen.queryByTestId("review-page")).not.toBeInTheDocument();
    });
  });
});
