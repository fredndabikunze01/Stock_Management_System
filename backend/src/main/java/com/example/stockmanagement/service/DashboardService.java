package com.example.stockmanagement.service;

import com.example.stockmanagement.dto.DashboardResponse;
import com.example.stockmanagement.dto.MovementResponse;
import com.example.stockmanagement.repository.ProductRepository;
import com.example.stockmanagement.repository.StockMovementRepository;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DashboardService {
    private final ProductRepository products;
    private final StockMovementRepository movements;
    private final int lowStockThreshold;

    public DashboardService(ProductRepository products, StockMovementRepository movements,
                            @Value("${app.low-stock-threshold}") int lowStockThreshold) {
        this.products = products;
        this.movements = movements;
        this.lowStockThreshold = lowStockThreshold;
    }

    @Transactional(readOnly = true)
    public DashboardResponse summary() {
        List<MovementResponse> recent = movements.findTop10ByOrderByCreatedAtDesc()
                .stream().map(MovementResponse::from).toList();
        return new DashboardResponse(products.count(), products.sumQuantities(),
                products.countByQuantityGreaterThanAndQuantityLessThanEqual(0, lowStockThreshold),
                products.countByQuantity(0), recent);
    }
}
