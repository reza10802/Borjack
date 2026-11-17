DELETE FROM "ProductImage" WHERE url !~ '^(/|https?://)';
UPDATE "Product" SET "isPublished" = false WHERE image !~ '^(/|https?://)';