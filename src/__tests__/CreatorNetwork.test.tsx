import { render, screen, fireEvent } from "@testing-library/react";
import CreatorNetwork from "@/components/network/CreatorNetwork";
import { acceptConnection, requestConnection, suggestCreators } from "@/lib/creatorNetwork";

const me = { address: "ME", name: "Me", tags: ["design", "web"] };
const creators = [
  { address: "A", name: "Ada", tags: ["Design", "web"] },
  { address: "B", name: "Bo", tags: ["audio"] },
  { address: "C", name: "Cy", tags: ["web"] },
];

describe("creator network", () => {
  it("suggests creators by shared tags, best match first", () => {
    const s = suggestCreators(me, creators, { connections: [], pending: [] });
    expect(s.map((x) => x.creator.address)).toEqual(["A", "C"]);
  });

  it("moves requests through pending to connected and ignores self", () => {
    const empty = { connections: [], pending: [] };
    expect(requestConnection(empty, "ME", "ME")).toBe(empty);
    const pending = requestConnection(empty, "ME", "A");
    expect(acceptConnection(pending, "A")).toEqual({ connections: ["A"], pending: [] });
  });

  it("shows a pending request after clicking Connect", () => {
    render(<CreatorNetwork me={me} creators={creators} />);
    fireEvent.click(screen.getAllByText("Connect")[0]);
    expect(screen.getByText("Pending (1)")).toBeInTheDocument();
  });
});
