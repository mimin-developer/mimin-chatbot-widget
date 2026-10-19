const CUSTOMER_TOKEN_KEY_PREFIX = "mimin-token";

export const isUnauthorized = (status: number): boolean => status === 401;

export const getCustomerTokenKey = (username?: string): string =>
  `${CUSTOMER_TOKEN_KEY_PREFIX}-${username}`;

export const getCustomerToken = (username?: string): string | null =>
  localStorage.getItem(getCustomerTokenKey(username));

export const clearCustomerToken = (username?: string): void => {
  localStorage.removeItem(getCustomerTokenKey(username));
};
