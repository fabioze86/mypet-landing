import { clientConfig } from "@/client.config";

const PALETTE = clientConfig.palette;

export const VITRINE_STYLES = `
        .cat-btn {
          padding: 8px 18px;
          border-radius: 100px;
          border: 1.5px solid ${PALETTE.gray200};
          background: ${PALETTE.white};
          color: ${PALETTE.gray600};
          font-family: var(--font-nunito), sans-serif;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }
        .cat-btn:hover { border-color: ${PALETTE.pink}; color: ${PALETTE.pink}; }
        .cat-btn.active {
          background: ${PALETTE.pink};
          border-color: ${PALETTE.pink};
          color: ${PALETTE.white};
        }

        .chip-row {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding: 10px 16px;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }
        .chip-row::-webkit-scrollbar { display: none; }

        .product-card {
          background: ${PALETTE.white};
          border-radius: 16px;
          border: 1px solid ${PALETTE.gray200};
          overflow: hidden;
          transition: transform 0.2s, box-shadow 0.2s;
          cursor: pointer;
          display: flex;
          flex-direction: column;
        }
        .product-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 32px rgba(26,52,114,0.10);
        }

        .unlock-btn {
          width: 100%;
          padding: 11px 0;
          background: ${PALETTE.navy};
          color: ${PALETTE.white};
          border: none;
          border-radius: 10px;
          font-family: var(--font-nunito), sans-serif;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          letter-spacing: 0.01em;
        }
        .unlock-btn:hover { background: ${PALETTE.navyDark}; }
        .unlock-btn.revealed {
          background: ${PALETTE.green};
          cursor: default;
        }

        .cta-primary {
          background: ${PALETTE.pink};
          color: ${PALETTE.white};
          border: none;
          border-radius: 100px;
          padding: 16px 36px;
          font-family: var(--font-nunito), sans-serif;
          font-size: 16px;
          font-weight: 800;
          cursor: pointer;
          transition: background 0.2s, transform 0.15s;
        }
        .cta-primary:hover { background: ${PALETTE.pinkDark}; transform: scale(1.03); }

        @media (max-width: 640px) {
          .products-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 14px !important; }
          .product-card-media { aspect-ratio: 1 / 1.08 !important; }
        }

        .vt-cartbar { position: sticky; bottom: 0; z-index: 20; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 16px; border-top: 1px solid; }
        .vt-cartbar-info { display: grid; font-size: 14px; font-weight: 700; }
        .vt-cartbar-frete { font-size: 12px; font-weight: 600; opacity: 0.85; }
`;
