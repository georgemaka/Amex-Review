# Delete Statement Debugging Guide

## Frontend Implementation Analysis

The delete functionality is properly implemented in the frontend:

1. **API Service** (`api.ts`):
   - `deleteStatement` method sends DELETE request to `/statements/{id}`
   - Includes console logging for debugging
   - Auth token is properly attached via interceptor

2. **Redux Store** (`statementSlice.ts`):
   - `deleteStatement` async thunk handles the API call
   - Updates state on success (removes from list)
   - Shows error notification on failure

3. **UI Component** (`StatementList.tsx`):
   - Delete button only shown for admin users
   - Confirmation dialog prevents accidental deletion
   - Proper error handling with notifications

## Debugging Steps

### 1. Check Browser Console (F12)

Look for these console messages when clicking delete:
```
Token getter called, returning: [token value]
Request interceptor - Token getter result: [token value]
Added auth header: Bearer [token value]
Request config: DELETE /api/v1/statements/[id]
Attempting to delete statement: [id]
Deleting statement with ID: [id]
```

### 2. Check Network Tab

1. Open Developer Tools (F12)
2. Go to Network tab
3. Click the delete button
4. Look for the DELETE request to `/api/v1/statements/{id}`

Check for:
- **Request URL**: Should be `http://localhost:8000/api/v1/statements/{id}`
- **Request Method**: DELETE
- **Status Code**: 
  - 200/204 = Success
  - 401 = Authentication issue
  - 403 = Permission issue
  - 404 = Statement not found
  - 500 = Server error
- **Request Headers**: Should include `Authorization: Bearer [token]`
- **Response**: Error details if failed

### 3. Common Issues and Solutions

#### Issue: 401 Unauthorized
**Symptoms**: 
- Status code 401
- Response: `{"detail": "Not authenticated"}`

**Solutions**:
1. Check if token is present in localStorage:
   ```javascript
   console.log(localStorage.getItem('token'))
   ```
2. Verify token is not expired
3. Try logging out and back in

#### Issue: 403 Forbidden
**Symptoms**:
- Status code 403
- Response: `{"detail": "Not enough permissions"}`

**Solutions**:
1. Verify user role is 'admin'
2. Check backend permissions

#### Issue: 500 Server Error
**Symptoms**:
- Status code 500
- Response contains error details

**Solutions**:
1. Check backend logs: `docker-compose logs backend`
2. Look for database constraint violations
3. Check if statement has related data preventing deletion

#### Issue: CORS Error
**Symptoms**:
- Network error
- Console shows CORS policy error

**Solutions**:
1. Verify backend CORS settings
2. Check if backend is running on correct port

### 4. Backend Verification

Check the backend delete endpoint:
```bash
# View backend logs
docker-compose logs -f backend

# Test with curl (replace TOKEN and ID)
curl -X DELETE http://localhost:8000/api/v1/statements/1 \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 5. Database Constraints

The delete might fail due to foreign key constraints. Check if the statement has:
- Related cardholder statements
- Related transactions
- Related analytics data

### 6. Quick Test

Add this temporary debug code to `StatementList.tsx` after line 90:

```typescript
const handleDeleteConfirm = async () => {
  if (statementToDelete) {
    console.log('=== DELETE DEBUG START ===');
    console.log('Statement ID:', statementToDelete);
    console.log('User:', user);
    console.log('Token from localStorage:', localStorage.getItem('token'));
    
    try {
      const result = await dispatch(deleteStatement(statementToDelete)).unwrap();
      console.log('Delete success, result:', result);
      // ... rest of success handling
    } catch (error: any) {
      console.error('=== DELETE DEBUG ERROR ===');
      console.error('Error type:', error.name);
      console.error('Error message:', error.message);
      console.error('Error response:', error.response);
      console.error('Error status:', error.response?.status);
      console.error('Error data:', error.response?.data);
      // ... rest of error handling
    }
  }
  // ... rest of function
};
```

## Next Steps

1. Provide the console output when attempting delete
2. Share the network request details (status, headers, response)
3. Check backend logs for any errors
4. If getting 500 error, share the full error response

This will help identify the exact issue and provide a targeted solution.