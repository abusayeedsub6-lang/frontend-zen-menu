import { useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  buildRestaurantQuery,
  resolveAdminId,
  resolveTableNumber,
} from '../utils/restaurant';

export function useRestaurantContext() {
  const [searchParams] = useSearchParams();
  const { restaurantId } = useParams();

  const adminId = useMemo(
    () => resolveAdminId(searchParams, restaurantId),
    [searchParams, restaurantId],
  );

  const tableNumber = useMemo(
    () => resolveTableNumber(searchParams, adminId),
    [searchParams, adminId],
  );

  const queryString = useMemo(
    () => buildRestaurantQuery(adminId, tableNumber),
    [adminId, tableNumber],
  );

  return {
    adminId,
    tableNumber,
    queryString,
    menuPath: `/menu${queryString}`,
    ordersPath: `/orders${queryString}`,
  };
}
