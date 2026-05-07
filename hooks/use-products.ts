"use client";

import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  bulkPatchProducts,
  getBrands,
  getCategories,
  getProduct,
  getStats,
  type ListProductsArgs,
  listProducts,
  patchProduct,
} from "@/lib/api-client";
import type { Product, ProductPatch, ProductsResponse } from "@/lib/types";

export function useProductsQuery(args: ListProductsArgs) {
  return useQuery<ProductsResponse>({
    queryKey: ["products", args],
    queryFn: ({ signal }) => listProducts({ ...args, signal }),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

export interface InfiniteProductsArgs {
  filter?: ListProductsArgs["filter"];
  sort?: ListProductsArgs["sort"];
  pageSize?: number;
}

export function useInfiniteProductsQuery(args: InfiniteProductsArgs) {
  const pageSize = args.pageSize ?? 200;
  return useInfiniteQuery<ProductsResponse>({
    queryKey: [
      "products",
      "infinite",
      { filter: args.filter, sort: args.sort, pageSize },
    ],
    queryFn: ({ pageParam, signal }) =>
      listProducts({
        filter: args.filter,
        sort: args.sort,
        page: pageParam as number,
        pageSize,
        signal,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const loaded = lastPage.page * lastPage.pageSize;
      return loaded < lastPage.filteredTotal ? lastPage.page + 1 : undefined;
    },
    staleTime: 15_000,
  });
}

export function useProductQuery(id: string | null) {
  return useQuery<Product>({
    queryKey: ["products", "byId", id],
    enabled: !!id,
    queryFn: ({ signal }) => getProduct(id as string, { signal }),
  });
}

export function useCategoriesQuery() {
  return useQuery<string[]>({
    queryKey: ["products", "categories"],
    queryFn: ({ signal }) => getCategories({ signal }),
    staleTime: 5 * 60_000,
  });
}

export function useBrandsQuery() {
  return useQuery<string[]>({
    queryKey: ["products", "brands"],
    queryFn: ({ signal }) => getBrands({ signal }),
    staleTime: 5 * 60_000,
  });
}

export function useStatsQuery() {
  return useQuery({
    queryKey: ["stats"],
    queryFn: ({ signal }) => getStats({ signal }),
    staleTime: 5 * 60_000,
    gcTime: 60 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function usePatchProductMutation() {
  const qc = useQueryClient();
  return useMutation<Product, unknown, { id: string; patch: ProductPatch }>({
    mutationFn: ({ id, patch }) => patchProduct(id, patch),
    onSuccess: (data) => {
      qc.setQueryData(["products", "byId", data.id], data);
      qc.invalidateQueries({ queryKey: ["products"], exact: false });
      qc.invalidateQueries({ queryKey: ["stats"] });
    },
  });
}

export function useBulkPatchMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: bulkPatchProducts,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"], exact: false });
      qc.invalidateQueries({ queryKey: ["stats"] });
    },
  });
}
