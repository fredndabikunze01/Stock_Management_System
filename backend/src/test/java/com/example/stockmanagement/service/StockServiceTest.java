package com.example.stockmanagement.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.stockmanagement.dto.StockRequest;
import com.example.stockmanagement.exception.BusinessRuleException;
import com.example.stockmanagement.model.Product;
import com.example.stockmanagement.model.StockMovement;
import com.example.stockmanagement.repository.ProductRepository;
import com.example.stockmanagement.repository.StockMovementRepository;
import java.math.BigDecimal;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class StockServiceTest {
    @Mock
    private ProductRepository products;
    @Mock
    private StockMovementRepository movements;

    private StockService service;
    private Product product;

    @BeforeEach
    void setUp() {
        service = new StockService(products, movements);
        product = new Product("KB-01", "Keyboard", null, new BigDecimal("24.90"), 5);
        when(products.findByIdForUpdate(1L)).thenReturn(Optional.of(product));
    }

    @Test
    void addStockUpdatesQuantityAndCreatesMovement() {
        when(movements.save(org.mockito.ArgumentMatchers.any(StockMovement.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        service.add(new StockRequest(1L, 3, "Delivery"));

        assertEquals(8, product.getQuantity());
        verify(movements).save(org.mockito.ArgumentMatchers.any(StockMovement.class));
    }

    @Test
    void removeStockRejectsQuantityAboveAvailableAndDoesNotSaveMovement() {
        assertThrows(BusinessRuleException.class,
                () -> service.remove(new StockRequest(1L, 6, "Order")));

        assertEquals(5, product.getQuantity());
        org.mockito.Mockito.verifyNoInteractions(movements);
    }
}
