package com.example.stockmanagement.service;

import com.example.stockmanagement.dto.MovementResponse;
import com.example.stockmanagement.dto.StockRequest;
import com.example.stockmanagement.exception.BusinessRuleException;
import com.example.stockmanagement.exception.ResourceNotFoundException;
import com.example.stockmanagement.model.MovementType;
import com.example.stockmanagement.model.Product;
import com.example.stockmanagement.model.StockMovement;
import com.example.stockmanagement.repository.ProductRepository;
import com.example.stockmanagement.repository.StockMovementRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class StockService {
    private final ProductRepository products;
    private final StockMovementRepository movements;

    public StockService(ProductRepository products, StockMovementRepository movements) {
        this.products = products;
        this.movements = movements;
    }

    @Transactional
    public MovementResponse add(StockRequest request) {
        return move(request, MovementType.IN);
    }

    @Transactional
    public MovementResponse remove(StockRequest request) {
        return move(request, MovementType.OUT);
    }

    @Transactional(readOnly = true)
    public List<MovementResponse> findMovements() {
        return movements.findAllByOrderByCreatedAtDesc().stream().map(MovementResponse::from).toList();
    }

    private MovementResponse move(StockRequest request, MovementType type) {
        Product product = products.findByIdForUpdate(request.productId())
                .orElseThrow(() -> new ResourceNotFoundException("Product " + request.productId() + " was not found."));
        if (type == MovementType.OUT && product.getQuantity() < request.quantity()) {
            throw new BusinessRuleException("Insufficient stock. Available quantity: " + product.getQuantity() + ".");
        }
        int updatedQuantity;
        try {
            updatedQuantity = type == MovementType.IN
                    ? Math.addExact(product.getQuantity(), request.quantity())
                    : product.getQuantity() - request.quantity();
        } catch (ArithmeticException exception) {
            throw new BusinessRuleException("Stock quantity exceeds the supported limit.");
        }
        product.setQuantity(updatedQuantity);
        StockMovement movement = movements.save(new StockMovement(product, type, request.quantity(),
                request.description() == null || request.description().isBlank() ? null : request.description().trim()));
        return MovementResponse.from(movement);
    }
}
