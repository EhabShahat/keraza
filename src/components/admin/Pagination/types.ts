export interface PaginationProps {
  /**
   * Current page index (0-based)
   */
  currentPage: number;
  
  /**
   * Total number of pages
   */
  totalPages?: number;
  
  /**
   * Whether there are more pages available
   * Used as an alternative to totalPages when the total count is unknown
   */
  hasNextPage?: boolean;
  
  /**
   * Callback when page changes
   */
  onPageChange: (page: number) => void;
  
  /**
   * Optional text to display showing current page info
   */
  pageInfo?: string;
  
  /**
   * Size of the pagination buttons
   */
  size?: "sm" | "md";
  
  /**
   * Additional CSS classes
   */
  className?: string;
}