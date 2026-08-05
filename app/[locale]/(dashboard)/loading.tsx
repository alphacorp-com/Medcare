import React from 'react'

function loading() {
    return (
        <div className="flex items-center justify-center h-full w-full">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
        </div>
    )
}

export default loading
