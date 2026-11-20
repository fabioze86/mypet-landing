import { classificarZona, type Zona } from "@mypet/core/frete";
import type { Buyer } from "@mypet/core/buyers-server";
import { FRETE_CONFIG } from "./frete.config";

export function zonaDoComprador(buyer: Pick<Buyer, "uf" | "municipio" | "cep" | "localizacao_status">): Zona {
  return classificarZona(
    { uf: buyer.uf, municipio: buyer.municipio, cep: buyer.cep, status: buyer.localizacao_status },
    FRETE_CONFIG,
  );
}
