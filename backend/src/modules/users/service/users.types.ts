type SearchUsersInput = {
  currentUserId: string;
  search: string;
  page: number;
  limit: number;
};

type SearchUserResult = {
  id: string;
  username: string;
  displayName: string;
};

type SearchUsersResult = {
  items: SearchUserResult[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type { SearchUsersInput, SearchUserResult, SearchUsersResult };
