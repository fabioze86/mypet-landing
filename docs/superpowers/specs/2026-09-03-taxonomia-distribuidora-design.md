# Taxonomia exclusiva da Distribuidora

## Objetivo

Permitir que a Distribuidora classifique cada produto ativo do canal `ffa_fabrica` em uma das cinco categorias principais abaixo, sem modificar a taxonomia global usada pelos demais sites:

1. Kits
2. Peitorais e Coleiras
3. Camas e colchonetes
4. Laços
5. Roupas

## Decisão

Adicionar uma taxonomia por canal em vez de reutilizar `categories`. A tabela `channel_categories` contém as categorias navegáveis de um canal e `product_channel_categories` associa um produto a uma categoria desse canal. Para `ffa_fabrica`, a associação será única por produto; a taxonomia inicial é plana, sem subcategorias.

`categories` e `products.category_id` permanecem inalteradas. Assim, MyPet, MadPet e qualquer outro consumidor de `getCategories()` preservam o comportamento atual.

## Administração

O Admin terá uma área exclusiva da Distribuidora. Ela lista as cinco categorias fixas e os produtos ativos vinculados ao canal `ffa_fabrica`, permitindo escolher uma categoria para cada produto. Produtos sem associação aparecem como “Sem categoria” e não são exibidos na navegação nem em uma listagem de categoria da Distribuidora até serem classificados.

## Vitrine

`apps/distribuidora` usará apenas as categorias de `channel_categories` do seu `catalogChannel`. O menu, chips, sitemap e rota `/categoria/[slug]` obtêm a árvore e os produtos por APIs channel-aware. Um slug inexistente retorna 404. A consulta de produtos conserva os filtros de status, preço e vínculo ao canal já existentes.

## Segurança e cache

As novas tabelas terão RLS: leitura pública para a vitrine e escrita para usuários existentes em `admin_users`. Atualizações no Admin invalidam a tag `catalog`, a mesma usada pelo catálogo atual.

## Fora de escopo

- Migrar ou inferir a categoria dos produtos existentes.
- Alterar `categories` ou a navegação de outros apps.
- Criar subcategorias para a Distribuidora.
